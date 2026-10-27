#!/usr/bin/env python3
"""シミュレータから、LP の画面写真（img/shots/*.webp）と録画クリップ（tools/work/*.mp4）を撮り直す。

  python3 tools/capture.py --app-repo /path/to/project-lantern            # 写真もクリップも全部
  python3 tools/capture.py --app-repo ... --only shots                    # 写真だけ
  python3 tools/capture.py --app-repo ... --only clips                    # クリップだけ
  python3 tools/capture.py --app-repo ... --name battle,result            # 名前を指定（カンマ区切り。写真・クリップの両方から）
  python3 tools/capture.py --app-repo ... --build                         # 撮り終わったら build_video.py も実行

動画は tools/build_video.py（cuts.json）で作る。"""
import argparse, json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORK = os.path.join(HERE, "work")
sys.path.insert(0, HERE)
from simlib import Sim, load_dictionary, play_battle  # noqa: E402


def run_steps(sim, steps, dictionary, shot_dir, on_record_mark=None):
    for st in steps:
        if "relaunch" in st: sim.relaunch()
        elif "wait" in st: time.sleep(st["wait"])
        elif "home" in st: sim.go_home()
        elif "stamina_ok" in st: sim.recover_stamina()
        elif "tap_if" in st: sim.tap_label(st["tap_if"], tries=2, required=False) and time.sleep(2.2)
        elif "tap" in st: sim.tap_label(st["tap"]); time.sleep(2.2)
        elif "tap_xy" in st: sim.tap_xy(*st["tap_xy"]); time.sleep(1)
        elif "swipe" in st: sim.swipe(*st["swipe"])
        elif "goto_stage" in st:
            for key in st["goto_stage"]:
                sim.tap_label(key); time.sleep(2.6)
                sim.tap_label("つぎへ", tries=1, required=False)  # 初回の説明が出たら閉じる
        elif "shot" in st:
            sim.screenshot(os.path.join(shot_dir, st["shot"] + ".png"))
        elif "battle" in st:
            b = st["battle"]
            play_battle(sim, dictionary, b.get("seconds", 120), b.get("wrong_every", 0), b.get("shots"), shot_dir)
        elif "_record_from_here" in st:
            if on_record_mark: on_record_mark()


def to_webp(png, out, width=600):
    from PIL import Image
    im = Image.open(png).convert("RGB")
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(out, "WEBP", quality=84, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app-repo", required=True, help="アプリ本体のリポジトリ（単語の辞書を読む）")
    ap.add_argument("--only", choices=["shots", "clips"])
    ap.add_argument("--name")
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--keep-running", action="store_true", help="終わってもシミュレータを止めない")
    a = ap.parse_args()
    cfg = json.load(open(os.path.join(HERE, "capture.json")))
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(os.path.join(ROOT, "img", "shots"), exist_ok=True)
    sim = Sim(cfg["udid"], cfg["bundle"])
    dictionary = load_dictionary(a.app_repo, os.path.join(WORK, "dict.json"))
    sim.boot()
    try:
        if a.only in (None, "shots"):
            for sh in cfg["shots"]:
                if a.name and sh["name"] not in a.name.split(","): continue
                print("写真:", sh["name"], flush=True)
                run_steps(sim, sh["steps"], dictionary, WORK)
                for f in os.listdir(WORK):
                    if f.endswith(".png"):
                        to_webp(os.path.join(WORK, f), os.path.join(ROOT, "img", "shots", f[:-4] + ".webp"))
                        os.remove(os.path.join(WORK, f))
        if a.only in (None, "clips"):
            for cl in cfg["clips"]:
                if a.name and cl["name"] not in a.name.split(","): continue
                print("録画:", cl["name"], flush=True)
                path = os.path.join(WORK, cl["name"] + ".mp4")
                steps = cl["steps"]
                marks = [i for i, s in enumerate(steps) if "_record_from_here" in s]
                if marks:  # 印のところから録画を始める（準備の操作は録画に入れない）
                    i = marks[0]
                    run_steps(sim, steps[:i], dictionary, WORK)
                    sim.record_start(path)
                    run_steps(sim, steps[i + 1:], dictionary, WORK)
                else:
                    sim.record_start(path)
                    run_steps(sim, steps, dictionary, WORK)
                sim.record_stop()
    finally:
        sim.record_stop()
        if not a.keep_running:
            sim.shutdown()  # ディスクと電池のため、使い終わったら止める
    if a.build:
        subprocess.run([sys.executable, os.path.join(HERE, "build_video.py")], check=True)


if __name__ == "__main__":
    main()
