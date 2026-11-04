"""
生成社交分享卡片图（1200x630），用于 og:image。

用法：
    python scripts/make-og-image.py <游戏截图> <输出png> [logo.png]
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

FONT_REG = r"C:\Windows\Fonts\msyh.ttc"
FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def draw_text(d: ImageDraw.ImageDraw, xy, text, f, fill, shadow=(0, 0, 0, 200), anchor=None):
    x, y = xy
    # 加一点投影，压在复杂背景上也能读
    d.text((x + 2, y + 2), text, font=f, fill=shadow, anchor=anchor)
    d.text((x, y), text, font=f, fill=fill, anchor=anchor)


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)

    shot_path, out_path = sys.argv[1], sys.argv[2]
    logo_path = sys.argv[3] if len(sys.argv) > 3 else None

    bg = Image.open(shot_path).convert("RGB")
    sw, sh = bg.size
    # 裁掉游戏自带的顶部标题、右上角计数和底部 HUD
    bg = bg.crop((0, int(sh * 0.13), sw, int(sh * 0.88)))
    sw, sh = bg.size

    # 居中裁剪到 1200x630
    target_ratio = W / H
    if sw / sh > target_ratio:
        nw = int(sh * target_ratio)
        bg = bg.crop(((sw - nw) // 2, 0, (sw + nw) // 2, sh))
    else:
        nh = int(sw / target_ratio)
        top = max(0, (sh - nh) // 2)
        bg = bg.crop((0, top, sw, top + nh))
    bg = bg.resize((W, H), Image.LANCZOS)

    # 整体压暗
    dark = Image.new("RGB", (W, H), (4, 11, 20))
    img = Image.blend(bg, dark, 0.52)

    # 左侧再加一层渐变，保证文字区域够暗
    alpha = np.zeros((H, W), dtype=np.uint8)
    for x in range(W):
        t = max(0.0, 1.0 - x / (W * 0.72))
        alpha[:, x] = int(215 * (t ** 1.5))
    shade = Image.new("RGB", (W, H), (2, 6, 12))
    img = Image.composite(shade, img, Image.fromarray(alpha, "L"))

    d = ImageDraw.Draw(img)

    # logo 放左上
    if logo_path:
        try:
            logo = Image.open(logo_path).convert("RGBA")
            lw = 300
            lh = int(logo.height * lw / logo.width)
            logo = logo.resize((lw, lh), Image.LANCZOS)
            img.paste(logo, (72, 56), logo)
        except OSError:
            pass

    draw_text(d, (72, 200), "力兔快跑", font(FONT_BOLD, 78), (238, 246, 255))
    draw_text(d, (76, 318), "GAI 周延 Real G 成都站", font(FONT_BOLD, 34), (240, 185, 85))
    draw_text(d, (76, 378), "跑过竹林 · 收满力力币 · 冲到舞台", font(FONT_REG, 26), (160, 196, 214))

    draw_text(d, (76, 458), "2027.1.2", font(FONT_BOLD, 30), (255, 227, 160))
    draw_text(d, (214, 462), "成都东安湖体育公园主体育场", font(FONT_REG, 26), (222, 236, 246))

    # 底部细线
    d.rectangle([72, 552, 72 + 420, 554], fill=(120, 170, 200, 120))

    # 右下角域名
    draw_text(d, (W - 72, H - 52), "gai781.top", font(FONT_BOLD, 30), (159, 212, 242), anchor="rs")

    img.save(out_path, quality=92)
    print(f"输出: {out_path}  {img.size}")


if __name__ == "__main__":
    main()
