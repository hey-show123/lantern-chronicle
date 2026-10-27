"""iOS シミュレータを idb と simctl で動かす小さな道具（capture.py から使う）。"""
import json, os, re, signal, subprocess, time

IDB = os.environ.get("IDB", os.path.expanduser("~/Library/Python/3.11/bin/idb"))


class Sim:
    def __init__(self, udid, bundle):
        self.udid, self.bundle = udid, bundle
        self._rec = None

    # ---- 画面の読み取り ----
    def elements(self):
        out = subprocess.run([IDB, "ui", "describe-all", "--udid", self.udid, "--json"], capture_output=True, text=True).stdout
        try:
            return json.loads(out)
        except ValueError:
            return []

    def labels(self):
        return {(e.get("AXLabel") or ""): e for e in self.elements()}

    # ---- 操作 ----
    def tap_xy(self, x, y):
        subprocess.run([IDB, "ui", "tap", "--udid", self.udid, str(x), str(y)], capture_output=True)

    def tap_el(self, e, wait=False):
        f = e["frame"]
        x, y = round(f["x"] + f["width"] / 2), round(f["y"] + f["height"] / 2)
        if wait:
            self.tap_xy(x, y)
        else:  # 待たずに押す（バトル中は速さが大事）
            subprocess.Popen([IDB, "ui", "tap", "--udid", self.udid, str(x), str(y)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def tap_label(self, key, tries=4, required=True):
        for _ in range(tries):
            labs = self.labels()
            hit = labs.get(key) or next((e for lab, e in labs.items() if key in lab), None)  # 完全一致を優先
            if hit:
                self.tap_el(hit, wait=True)
                return True
            time.sleep(1)
        if required:
            raise RuntimeError(f"画面に「{key}」が見つかりません")
        return False

    def swipe(self, x1, y1, x2, y2, dur=0.6):
        subprocess.run([IDB, "ui", "swipe", "--udid", self.udid, str(x1), str(y1), str(x2), str(y2), "--duration", str(dur)], capture_output=True)

    def screenshot(self, path):
        subprocess.run(["xcrun", "simctl", "io", self.udid, "screenshot", path], capture_output=True)

    def relaunch(self):
        subprocess.run(["xcrun", "simctl", "terminate", self.udid, self.bundle], capture_output=True)
        time.sleep(1)
        subprocess.run(["xcrun", "simctl", "launch", self.udid, self.bundle], capture_output=True)

    def boot(self):
        subprocess.run(["xcrun", "simctl", "boot", self.udid], capture_output=True)
        time.sleep(6)
        # アプリを前に出す（動いていなければ起動して、タイトルが出るまで待つ）
        subprocess.run(["xcrun", "simctl", "launch", self.udid, self.bundle], capture_output=True)
        time.sleep(9)

    def shutdown(self):
        subprocess.run(["xcrun", "simctl", "shutdown", self.udid], capture_output=True)

    # ---- 録画 ----
    def record_start(self, path):
        self._rec = subprocess.Popen(["xcrun", "simctl", "io", self.udid, "recordVideo", "--codec=h264", "--force", path],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.5)

    def record_stop(self):
        if self._rec:
            time.sleep(1)
            self._rec.send_signal(signal.SIGINT)
            self._rec.wait()
            self._rec = None

    # ---- ホームに戻る（結果画面・マップ・ダイアログを順に閉じる） ----
    def go_home(self):
        for _ in range(14):
            labs = self.labels()
            for k in ("タップしてスタート", "リトライ", "つぎへ", "マップへ", "OK", "閉じる", "戻る"):
                if k in labs:
                    self.tap_el(labs[k], wait=True)
                    break
            else:
                if "ホーム" in labs:
                    # ホーム以外のタブにいるかもしれないので、タブのホームを押す
                    self.tap_el(labs["ホーム"], wait=True)
                    time.sleep(1.5)
                    return
            time.sleep(1.8)

    def recover_stamina(self):
        labs = self.labels()
        if any("スタミナが不足" in l for l in labs):
            self.tap_label("スタミナを回復")
            time.sleep(1.5)
            self.tap_label("回復する")
            time.sleep(2)


# ---- バトルの自動操作 ----
def load_dictionary(app_repo, cache):
    """content/*/words/*.json と wordlist.csv から 英単語 → 日本語の意味（複数）の辞書を作る。"""
    if os.path.exists(cache):
        return json.load(open(cache))
    import csv, glob, collections
    d = collections.defaultdict(set)
    for base in glob.glob(os.path.join(app_repo, "content", "en-*")):
        for f in glob.glob(os.path.join(base, "words", "*.json")):
            for w in json.load(open(f)):
                for s in w.get("senses", []):
                    for k in ("ja", "recall_ja"):
                        for j in s.get(k) or []:
                            d[w["lemma"].lower()].add(j)
        wl = os.path.join(base, "wordlist.csv")
        if os.path.exists(wl):
            for r in csv.DictReader(open(wl)):
                if r.get("lemma") and r.get("ja"):
                    d[r["lemma"].lower()].add(r["ja"])
    out = {k: sorted(v) for k, v in d.items()}
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    json.dump(out, open(cache, "w"), ensure_ascii=False)
    return out


def play_battle(sim, dictionary, seconds=120, wrong_every=0, shots=None, shot_dir=None):
    """落ちてくる単語を読み、同じレーンの正解ボタンを押す。ゲージが満タンならスキルも押す。
    shots=[{"t": 秒, "name": 名前}] で、バトル開始から t 秒後に画面を撮る。"""
    start = time.time(); end = start + seconds; empty = 0; cnt = 0; last_skill = 0
    pending = sorted(shots or [], key=lambda s: s["t"])
    while time.time() < end:
        els = sim.elements(); cards = []; btns = []
        for e in els:
            lab = e.get("AXLabel") or ""; f = e["frame"]
            if re.fullmatch(r"[A-Za-z' .\-]+", lab) and f["width"] > 100 and f["y"] < 700:
                cards.append((lab.lower().strip(), f))
            g = re.search(r"ゲージ (\d+) / 8", lab)
            if g and g.group(1) == "8" and time.time() - last_skill > 3:
                sim.tap_el(e); last_skill = time.time(); print("  スキル発動", lab, flush=True)
            m = re.match(r"(左|右)レーン：(.+)", lab)
            if m:
                btns.append((m.group(1), m.group(2), e))
        for lane in ("左", "右"):
            cs = [c for c in cards if (c[1]["x"] < 220) == (lane == "左")]
            if not cs:
                continue
            w, _ = max(cs, key=lambda c: c[1]["y"])
            ja = dictionary.get(w) or dictionary.get(w.rstrip("s")) or []
            cnt += 1
            wrong = wrong_every > 0 and cnt % wrong_every == 0
            for l, t, e in btns:
                if l == lane and ((t not in ja) if wrong else (t in ja)):
                    sim.tap_el(e); break
        empty = empty + 1 if (not cards and not btns) else 0
        while pending and time.time() - start >= pending[0]["t"]:
            s = pending.pop(0)
            sim.screenshot(os.path.join(shot_dir, s["name"] + ".png"))
        if empty >= 10:
            break
