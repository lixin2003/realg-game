"""
把美术给的角色图处理成游戏可用的像素 sprite。

做的事：去白底 → 裁切到角色边界 → 等比缩放到指定画布 → 颜色量化去掉渐变。

用法：
    python scripts/prepare-character.py <输入图> <输出png> --height 34 --canvas 32x36

参数：
    --height    角色内容的高度（像素）
    --canvas    画布尺寸，格式 宽x高，默认按内容比例自动
"""
import argparse
import numpy as np
from PIL import Image


def remove_white(img: Image.Image) -> Image.Image:
    arr = np.array(img.convert("RGBA")).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    pure_white = (r > 238) & (g > 238) & (b > 238)
    near_white = (r > 205) & (g > 205) & (b > 205) & ~pure_white

    alpha = arr[:, :, 3]
    alpha[pure_white] = 0
    brightness = (r + g + b) / 3.0
    fade = np.clip((238 - brightness) / 33.0, 0, 1)
    alpha[near_white] = (alpha[near_white] * fade[near_white]).astype(np.int16)

    arr[:, :, 3] = np.clip(alpha, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def crop_to_content(img: Image.Image, min_pixels: int = 8) -> Image.Image:
    """按行/列的不透明像素数量裁切，滤掉零星噪点，只保留主体。"""
    alpha = np.array(img)[:, :, 3]
    opaque = alpha > 10

    rows = np.nonzero(opaque.sum(axis=1) >= min_pixels)[0]
    cols = np.nonzero(opaque.sum(axis=0) >= min_pixels)[0]
    if len(rows) == 0 or len(cols) == 0:
        raise SystemExit("没有检测到不透明像素，检查输入图")

    return img.crop(
        (int(cols.min()), int(rows.min()), int(cols.max()) + 1, int(rows.max()) + 1)
    )


def quantize(img: Image.Image, step: int = 16) -> Image.Image:
    arr = np.array(img).astype(np.int16)
    rgb = arr[:, :, :3]
    rgb = (rgb // step) * step + step // 2
    arr[:, :, :3] = np.clip(rgb, 0, 255)
    arr[:, :, 3] = np.where(arr[:, :, 3] > 110, 255, 0)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def load_sprite(path: str) -> Image.Image:
    """
    读入角色图。

    如果原图自带透明通道（美术已经抠好图），直接使用，绝不再按白色判断背景，
    否则角色身上的白色（白衣服、白鞋、眼白）会被一起删掉。
    只有原图完全不透明时，才按白底图处理。
    """
    img = Image.open(path).convert("RGBA")
    alpha = np.array(img)[:, :, 3]
    if alpha.min() < 250:
        print("检测到透明通道，保留原图（不抠白）")
        return img
    print("原图不透明，按白底处理")
    return remove_white(img)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--height", type=int, default=46)
    ap.add_argument("--canvas", default="")
    ap.add_argument("--quant-step", type=int, default=16)
    args = ap.parse_args()

    img = load_sprite(args.src)
    img = crop_to_content(img)
    print(f"裁切后尺寸: {img.size}")

    scale = args.height / img.height
    size = (max(1, round(img.width * scale)), args.height)

    if args.canvas:
        cw, ch = (int(v) for v in args.canvas.lower().split("x"))
        if size[0] > cw - 2:
            scale = (cw - 2) / img.width
            size = (cw - 2, max(1, round(img.height * scale)))
        if size[1] > ch - 2:
            scale = (ch - 2) / img.height
            size = (max(1, round(img.width * scale)), ch - 2)
    else:
        cw, ch = size[0] + 2, size[1] + 2

    # 先放大两倍再缩回，减少一次降采样的锯齿
    big = img.resize((size[0] * 2, size[1] * 2), Image.LANCZOS)
    small = big.resize(size, Image.LANCZOS)
    small = quantize(small, args.quant_step)

    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(small, ((cw - size[0]) // 2, ch - size[1]), small)
    canvas.save(args.dst)
    print(f"输出: {args.dst}  画布 {canvas.size}  内容 {size}")


if __name__ == "__main__":
    main()
