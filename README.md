# ランタンクロニクル 事前登録サイト

英単語RPG「ランタンクロニクル」の事前登録ページです。
公開先: https://hey-show123.github.io/lantern-chronicle/
お問い合わせ: hey_show.dev@outlook.jp

## 画面写真と動画の差し替え（いちばんよく使う）

画面写真とプレイ動画は、ぜんぶ `media.json` で決まります。HTML は触りません。

- 写真を1枚変える: `img/shots/` に新しい画像を置き、`media.json` の `file` を1行直す。
- 説明文を変える: `media.json` の `title`・`caption`・`alt` を直す。
- 並び順を変える: `media.json` の `shots` の順番を入れ替える（いまはバトルが先頭）。
- 写真を足す・減らす: `shots` に1件足す・消す。
- スマホの枠は `img/phone-frame.webp` の1枚を全部の写真で使い回す。写真は枠の中に、ふつうの画像として入る。
  - 枠の中の画面の位置は `media.json` の `phone.screen`（枠に対する % ）。

写真の大きさの目安: 縦長のスマホ画面（幅 600px 前後、iPhone の比率）。

## シミュレータから撮り直す（バトルの見た目が変わったとき）

1つのコマンドで、写真と動画をまとめて作り直せます。

```bash
python3 tools/capture.py --app-repo /Volumes/HD-ADU3/モチタンクローン --build
```

やること:
1. シミュレータ「Lantern iPhone 17 Pro Max」を使う（新しい端末は作らない）。使っているあいだは `~/lantern-tools/sim-lock-iphone` に名前を書き、ほかの作業が使っていたら止まる。
2. `tools/capture.json` の手順どおりに画面を動かし、`img/shots/*.webp` を撮る。
3. 同じく録画のクリップを `tools/work/*.mp4` に撮る（このフォルダは git に入れない）。
4. `--build` があれば `tools/build_video.py` が `tools/cuts.json` を読み、`img/promo.mp4` とポスター画像を作る。
5. シミュレータは起動したままにする（2台とも起動したままにする決まり。止めたいときだけ `--shutdown`）。

ほかの手順ファイルで撮る（例: TikTok 用。アプリのリポジトリの `output/tiktok/capture_tiktok.json`）: `--config <手順のファイル> --work <録画の置き場>` を足す。

一部だけ撮り直す:

```bash
python3 tools/capture.py --app-repo /Volumes/HD-ADU3/モチタンクローン --name battle
```

```bash
python3 tools/build_video.py
```

必要なもの: Xcode のシミュレータ、idb（`~/Library/Python/3.11/bin/idb`）、ffmpeg、Python の Pillow。
アプリは、そのシミュレータに入っている版を使う（ゲストでログイン済みの状態）。

### 手順の直し方（`tools/capture.json`）

- `shots` は写真、`clips` は録画。どちらも `steps` を上から順に実行する。
- 使える手順:
  - `{"relaunch": true}` アプリを起動し直す
  - `{"home": true}` 結果画面やダイアログを閉じてホームに戻る
  - `{"tap": "表示名"}` その名前のボタンを押す（完全一致を優先、なければ部分一致）。見つからないと止まる
  - `{"tap_if": "表示名"}` あれば押す（無くても止まらない）
  - `{"tap_xy": [x, y]}` 座標を押す（ポイント単位）
  - `{"swipe": [x1, y1, x2, y2, 秒]}` なぞる（ガチャのひもなど）
  - `{"tap_below": {"label": "文字", "dx": 76, "dy": 44}}` 名前の無いボタンを、その文字の下からの位置で押す（ガチャの「引く」など）
  - `{"goto_stage": ["冒険、", "ストーリー、", "序章", "ステージ2"]}` 順に押してステージを開く
  - `{"stamina_ok": true}` スタミナ不足なら回復する
  - `{"battle": {"seconds": 120, "wrong_every": 0, "shots": [{"t": 9, "name": "battle"}]}}` バトルを自動で遊ぶ。`shots` で開始から t 秒後に写真を撮る
  - `{"shot": "名前"}` いまの画面を撮る
  - `{"wait": 秒}` 待つ
  - `{"_record_from_here": true}` 録画をここから始める（それより前の準備は録画しない）
- ボタンの表示名が変わったら、ここの言葉を直す。
- バトルは、始めたばかりのゲストでも撮れるように序章のステージ1。`"pace": 0.9` で答える間をあけると、人が遊ぶ速さに見える。バトルの自動操作は、落ちてくる英単語と「左レーン：意味」「右レーン：意味」のボタンを読んで正解を押す。バトル画面の作りが変わったら `tools/simlib.py` の `play_battle` を直す。

### 動画の直し方（`tools/cuts.json`）

- `cuts` は使う場面の表。`clip` はクリップ名、`start` は録画の何秒目から、`dur` は何秒使うか、`caption` は下の帯の文字。
- 録画を撮り直したら、場面の秒数がずれるので、`tools/work/*.mp4` を見て `start` を合わせる。
- 最後の案内画面は `end`（背景の絵・文字）。文字だけ変えたいときは、撮り直さずに `python3 tools/build_video.py --end-only` で案内画面だけ作り直せる。タイトルだけ撮り直したときは `--title-only`（最初の場面だけ入れかえる）。

## ヒーロー（いちばん上の絵）

- `img/hero/layers.json` に層の絵と、動く量（`depth`）、灯台の光の位置（`lamp`、%）を書く。
- `tall` はスマホ、`wide` は PC。`wide` が無いあいだは、PC は1枚絵（`img/hero-wide.webp`）で動く。
- 層の元の絵: アプリのリポジトリ `design/concepts/lp/title-layers/`（スマホ）と `title-layers/wide/`（PC）。
- PC の灯台の層（`img/hero/wide/lighthouse.webp`）は、元の絵の光の帯にあったピンク色を金色に直した版。
- PC では絵を切らずに見せ、キャッチコピーとボタンは絵の下の帯に置く。スマホは絵の下のほうに重ねる。

## 公式SNSのリンクと App Store のボタン（`site.json`）

- `sns` に4つ（X・TikTok・Instagram・YouTube）のユーザー名（@ なし）が入っている。アカウントができたら、その行の `live` を `true` にすると、登録のところとフッターにリンクが出る。名前がその SNS の決まりに合わないとき（X は15字まで など）は出ない。
- `app_store_url` に App Store のページの URL を入れると、いちばん上に「App Store で予約注文」のボタンが出る。
- 共有したときに出る画像は `img/og.jpg`（1200×630）。

## 事前登録の受け口

- Supabase の Edge Function `prereg`（コードはアプリのリポジトリ `infra/prereg/`）。
- 確認メール（二重確認）は、送信の鍵を入れると有効になる（`output/lp/PREREG_BACKEND.md`）。

