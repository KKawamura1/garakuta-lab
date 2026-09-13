#!/usr/bin/env python3
"""ecology/art/ の配信用画像を docs/art/ の原本から作り直す。

**原本は触らない。**`docs/art/bustup_v0/*.png` は 1086x1448 前後・1枚 2.3〜3.1MB の
保管用で、そのまま配ると5人ぶんで 13MB になる（会話の立ち絵が後から出ていたのは
これが理由である）。ここで作るのは配信用の派生だけで、次の2種類を吐く。

  ecology/art/portraits/<id>.webp … 会話UIの立ち絵。長辺 640px の WebP。
  ecology/art/title-cast.webp     … タイトル画面の5人。原本を並べて暗くした1枚。

出力はリポジトリへコミットする（Pages は静的配信で、build 時に画像処理をしない）。
Pillow が要る: python3 -m pip install pillow && python3 analysis/art-web-assets.py
"""
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/art/bustup_v0"
OUT = ROOT / "ecology/art"

PORTRAIT_HEIGHT = 640
PORTRAIT_QUALITY = 82

# タイトルの画。**幕は5人、主役は中央。**外側ほど小さく、暗く、後ろへ置く。
# 上の余白（HEADROOM）は表題を置く場所で、絵を入れない。
TITLE_W, TITLE_FIGURES_H, TITLE_HEADROOM = 1800, 1050, 450
TITLE_QUALITY = 78
TITLE_LAYOUT = [
    # (id, 高さ比, 中心x比, 下げ比, 明るさ)
    ("hibana", 0.74, 0.135, 0.10, 0.42),
    ("genzou", 0.74, 0.865, 0.10, 0.42),
    ("nagi", 0.85, 0.305, 0.03, 0.58),
    ("tsugumi", 0.85, 0.695, 0.03, 0.58),
    ("gou", 0.98, 0.500, 0.00, 0.80),
]


def trimmed(name):
    image = Image.open(SRC / f"{name}.png").convert("RGBA")
    return image.crop(image.getbbox())


def darkened(image, factor):
    red, green, blue, alpha = image.split()
    rgb = ImageEnhance.Brightness(Image.merge("RGB", (red, green, blue))).enhance(factor)
    return Image.merge("RGBA", (*rgb.split(), alpha))


def write_portraits():
    (OUT / "portraits").mkdir(parents=True, exist_ok=True)
    for path in sorted(SRC.glob("*.png")):
        image = Image.open(path).convert("RGBA")
        scale = PORTRAIT_HEIGHT / image.height
        resized = image.resize((round(image.width * scale), PORTRAIT_HEIGHT), Image.LANCZOS)
        target = OUT / "portraits" / f"{path.stem}.webp"
        resized.save(target, "WEBP", quality=PORTRAIT_QUALITY, method=6)
        print(f"{target.relative_to(ROOT)} {resized.size} {target.stat().st_size // 1024}KB")


def write_title_cast():
    height = TITLE_FIGURES_H + TITLE_HEADROOM
    canvas = Image.new("RGBA", (TITLE_W, height), (0, 0, 0, 0))
    for name, scale, center_x, drop, brightness in TITLE_LAYOUT:
        figure = trimmed(name)
        figure_height = round(TITLE_FIGURES_H * scale)
        figure = figure.resize(
            (round(figure.width * figure_height / figure.height), figure_height), Image.LANCZOS)
        figure = darkened(figure, brightness)
        x = round(TITLE_W * center_x - figure.width / 2)
        y = round(height - figure_height + TITLE_FIGURES_H * drop)
        canvas.alpha_composite(figure, (x, y))
    target = OUT / "title-cast.webp"
    canvas.save(target, "WEBP", quality=TITLE_QUALITY, method=6)
    print(f"{target.relative_to(ROOT)} {canvas.size} {target.stat().st_size // 1024}KB")


if __name__ == "__main__":
    write_portraits()
    write_title_cast()
