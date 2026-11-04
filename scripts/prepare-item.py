"""
处理道具图。和 prepare-character.py 的区别：
不做颜色量化，保留原图细节，适合需要看清图案的图。

用法：
    python scripts/prepare-item.py <原图> <输出png> --size 80
"""
import argparse
import numpy as np
from PIL import Image


def load(path: str) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    alpha = np.array(img)[:, :, 3]
    if alpha.min() < 250:
        print("检测到透明通道，保留原图")
        return img

    # 不透明图按白底处理
    print("原图不透明，去白底")
    arr = np.array(img).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    pure_white = (r > 240) & (g > 240) & (b > 240)
    near_white = (r > 210) & (g > 210) & (b > 210) & ~pure_white

    a = arr[:, :, 3]
    a[pure_white] = 0
    brightness = (r + g + b) / 3.0
    fade = np.clip((240 - brightness) / 30.0, 0, 1)
    a[near_white] = (a[near_white] * fade[near_white]).astype(np.int16)
    arr[:, :, 3] = np.clip(a, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--size", type=int, default=80)
    args = ap.parse_args()

    img = load(args.src)

    a = np.array(img)[:, :, 3]
    ys, xs = np.nonzero(a > 8)
    img = img.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    print(f"裁切后: {img.size}")

    size = (args.size, args.size)
    # 两段式缩放，细节保留更好
    mid = img.resize((size[0] * 3, size[1] * 3), Image.LANCZOS)
    out = mid.resize(size, Image.LANCZOS)
    out.save(args.dst)
    print(f"输出: {args.dst}  {out.size}")


if __name__ == "__main__":
    main()
