#!/usr/bin/env python3
"""tools/cuts.json を読んで、tools/work のクリップから img/promo.mp4 と ポスター画像を作る（ffmpeg が必要）。

  python3 tools/build_video.py             # 全部作り直す（tools/work のクリップが要る）
  python3 tools/build_video.py --end-only  # 最後の案内画面だけ作り直す（いまの promo.mp4 の前半をそのまま使う。撮り直し不要）"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); WORK = os.path.join(HERE, "work")
cfg = json.load(open(os.path.join(HERE, "cuts.json")))
W, PH = cfg["size"]; B = cfg["band"]; H = PH + B
FONT = cfg["font"]
OUT = os.path.join(ROOT, cfg["out"]["video"])


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args, check=True)


def fit_font(d, text, size, max_w):
    f = ImageFont.truetype(FONT, size)
    while d.textlength(text, font=f) > max_w and size > 12:
        size -= 2; f = ImageFont.truetype(FONT, size)
    return f


def caption_png(text, path):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((0, PH, W, H), fill=(14, 16, 48, 255)); d.line((0, PH, W, PH), fill=(255, 201, 74, 255), width=3)
    d.text((W / 2, PH + B / 2), text, font=fit_font(d, text, 34, W - 40), fill=(255, 244, 216, 255), anchor="mm")
    im.save(path)


def make_cuts():
    parts = []
    for i, c in enumerate(cfg["cuts"]):
        cap = os.path.join(WORK, f"cap{i}.png"); caption_png(c["caption"], cap)
        out = os.path.join(WORK, f"cut{i}.mp4"); dur = c["dur"]
        fc = (f"[0:v]fps=30,scale={W}:{PH}:flags=lanczos,pad={W}:{H}:0:0:color=0x0e1030[b];"
              f"[b][1:v]overlay=0:0,fade=t=in:st=0:d=0.25,fade=t=out:st={dur - 0.25}:d=0.25[o]")
        run(["-ss", str(c["start"]), "-t", str(dur), "-i", os.path.join(WORK, c["clip"] + ".mp4"), "-loop", "1", "-i", cap,
             "-filter_complex", fc, "-map", "[o]", "-t", str(dur), "-an", "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", out])
        parts.append(out)
    return parts


def make_end():
    e = cfg["end"]; dur = e["dur"]
    hero = Image.open(os.path.join(ROOT, e["image"])).convert("RGB")
    hero = hero.resize((1080, round(hero.height * 1080 / hero.width)))
    cw = round(hero.height * W / H); x0 = (hero.width - cw) // 2
    hero.crop((x0, 0, x0 + cw, hero.height)).save(os.path.join(WORK, "end_bg.png"))
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0)); g = ImageDraw.Draw(over)
    for y in range(H // 2, H):
        g.line((0, y, W, y), fill=(14, 16, 48, int(235 * ((y - H // 2) / (H // 2)) ** 1.3)))
    g.rounded_rectangle((W / 2 - 150, H - 300, W / 2 + 150, H - 246), radius=27, fill=(255, 122, 92, 255))
    g.text((W / 2, H - 273), e["badge"], font=fit_font(g, e["badge"], 30, 280), fill=(255, 255, 255, 255), anchor="mm")
    g.text((W / 2, H - 190), e["title"], font=fit_font(g, e["title"], 44, W - 40), fill=(255, 244, 216, 255), anchor="mm")
    g.text((W / 2, H - 130), e["sub"], font=fit_font(g, e["sub"], 26, W - 40), fill=(255, 201, 74, 255), anchor="mm")
    over.save(os.path.join(WORK, "end_over.png"))
    endv = os.path.join(WORK, "cut_end.mp4"); n = int(dur * 30)
    run(["-loop", "1", "-i", os.path.join(WORK, "end_bg.png"), "-loop", "1", "-i", os.path.join(WORK, "end_over.png"), "-filter_complex",
         f"[0:v]zoompan=z='1.0+0.06*on/{n}':x='iw/2-(iw/zoom/2)':y='0':d={n}:s={W}x{H}:fps=30[z];[z][1:v]overlay=0:0,fade=t=in:st=0:d=0.3,fade=t=out:st={dur - 0.3}:d=0.3[o]",
         "-map", "[o]", "-t", str(dur), "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", endv])
    return endv


def old_head():
    """いまの promo.mp4 から、最後の案内画面より前を切り出す（案内画面の長さは cuts.json の end.dur と同じとみなす）。"""
    total = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", OUT],
                                 capture_output=True, text=True).stdout)
    head = os.path.join(WORK, "head.mp4")
    run(["-i", OUT, "-t", f"{total - cfg['end']['dur']:.3f}", "-an", "-c:v", "libx264", "-crf", "22", "-pix_fmt", "yuv420p", head])
    return head


def concat(parts):
    lst = os.path.join(WORK, "list.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    tmp = os.path.join(WORK, "promo_new.mp4")
    run(["-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", tmp])
    os.replace(tmp, OUT)
    run(["-ss", str(cfg["out"]["poster_at"]), "-i", OUT, "-frames:v", "1", "-q:v", "4", os.path.join(ROOT, cfg["out"]["poster"])])
    print("できた:", OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    os.makedirs(WORK, exist_ok=True)
    if "--end-only" in sys.argv:
        concat([old_head(), make_end()])
    else:
        concat(make_cuts() + [make_end()])
