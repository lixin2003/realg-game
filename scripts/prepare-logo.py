"""
把白底线稿 logo 处理成透明底的发光字，用于深色背景上的标题和舞台大屏。

白底会被去掉，线条保留并统一染成指定颜色，保留线稿的锋利感。

用法：
    python scripts/prepare-logo.py <输入图> <输出png> --width 320 --color f3e2c0
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--width", type=int, default=320)
    ap.add_argument("--color", default="f3e2c0")
    ap.add_argument("--gamma", type=float, default=0.75)
    args = ap.parse_args()

    img = Image.open(args.src).convert("RGBA")
    arr = np.array(img).astype(np.float32)

    # 大多数情况下美术给的图已经是透明底，直接用 alpha 当形状；
    # 如果是不透明图，就按亮度反相，暗的地方算线条。
    src_alpha = arr[:, :, 3] / 255.0
    if src_alpha.min() < 0.99:
        alpha = src_alpha
    else:
        lum = arr[:, :, :3].mean(axis=2)
        alpha = np.clip((190.0 - lum) / 110.0, 0, 1) ** args.gamma

    h, w = alpha.shape
    new_w = args.width
    new_h = max(1, round(h * new_w / w))

    rgb = tuple(int(args.color[i : i + 2], 16) for i in (0, 2, 4))
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[:, :, 0] = rgb[0]
    out[:, :, 1] = rgb[1]
    out[:, :, 2] = rgb[2]
    out[:, :, 3] = (alpha * 255).astype(np.uint8)

    res = Image.fromarray(out, "RGBA").resize((new_w, new_h), Image.LANCZOS)

    # 缩小后细线会糊，先加粗一圈再提对比，让小尺寸下依然能读
    a_img = Image.fromarray((np.array(res)[:, :, 3]).astype(np.uint8))
    a_img = a_img.filter(ImageFilter.MaxFilter(3))
    b = np.array(res).astype(np.float32)
    a = np.array(a_img).astype(np.float32) / 255.0
    b[:, :, 3] = (np.clip(a * 1.25, 0, 1) * 255).astype(np.uint8)

    Image.fromarray(b.astype(np.uint8), "RGBA").save(args.dst)
    print(f"输出: {args.dst}  {new_w}x{new_h}")


if __name__ == "__main__":
    main()
