"""把 AI 生成的"像素风"图片整理成真正的像素图：每个像素大小一致、颜色干净、背景透明。

用法（在项目根目录运行，需要 Pillow：python3 -m pip install pillow）：
    python3 tools/pixelize.py 输入.png 输出.png --block 12.5 --colors 16

步骤：
1. 去背景残留：透明度低于一半的像素变成全透明；很暗的灰色污渍（AI 去背景时留下的）也去掉
2. 重新采样：先找出最合适的网格起点，再把每 block×block 的区域合成一个像素，
   取区域中间部分出现最多的颜色（避开边缘的过渡色）
3. 统一配色：合并成最多 colors 种颜色，去掉颜色噪点
4. 裁掉四周的透明空白

--block 是原图里"一个像素块"大约多少像素，可以放大原图用肉眼量。
"""
import argparse
from collections import Counter
from pathlib import Path

from PIL import Image


def is_artifact(r, g, b):
    # 翅膀都是白、粉、浅紫这类亮色；最亮的通道都低于 170 的，是灰色或深色污渍
    return max(r, g, b) < 170


def clean_alpha(im):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 128 or is_artifact(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, 255)
    return im


def find_offset(im, block, step=1.0):
    """试不同的网格起点，选"每个格子颜色最统一"的那个（AI 图的像素块不一定从左上角开始）"""
    px = im.load()
    best = (-1, 0.0, 0.0)
    n = int(block / step)
    for i in range(n):
        for j in range(n):
            ox, oy = i * step, j * step
            pure = total = 0
            # 抽样：每隔 3 个格子看一个，速度快很多
            for gy in range(0, int((im.height - oy) / block), 3):
                for gx in range(0, int((im.width - ox) / block), 3):
                    x0, y0 = int(ox + gx * block), int(oy + gy * block)
                    c = px[x0 + int(block / 2), y0 + int(block / 2)]
                    if not c[3]:
                        continue
                    for (x, y) in ((x0 + 2, y0 + 2), (int(x0 + block) - 3, y0 + 2),
                                   (x0 + 2, int(y0 + block) - 3), (int(x0 + block) - 3, int(y0 + block) - 3)):
                        q = px[x, y]
                        total += 1
                        if q[3] and sum(abs(q[k] - c[k]) for k in range(3)) < 24:
                            pure += 1
            score = pure / total if total else 0
            if score > best[0]:
                best = (score, ox, oy)
    return best


def resample(im, block, offset=(0.0, 0.0), margin=0.2):
    px = im.load()
    offx, offy = offset
    out_w = int((im.width - offx) / block)
    out_h = int((im.height - offy) / block)
    out = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    opx = out.load()
    for oy in range(out_h):
        for ox in range(out_w):
            # 只看格子中间部分
            x0 = int(offx + ox * block + block * margin)
            x1 = max(x0 + 1, int(offx + (ox + 1) * block - block * margin))
            y0 = int(offy + oy * block + block * margin)
            y1 = max(y0 + 1, int(offy + (oy + 1) * block - block * margin))
            colors = Counter()
            total = 0
            for y in range(y0, min(y1, im.height)):
                for x in range(x0, min(x1, im.width)):
                    total += 1
                    r, g, b, a = px[x, y]
                    if a:
                        # 先粗分组（每通道 16 级）再计数，近似的颜色算同一种
                        colors[(r >> 4, g >> 4, b >> 4)] += 1
            opaque = sum(colors.values())
            if not total or opaque < total * 0.5:
                continue
            key, _ = colors.most_common(1)[0]
            # 取这一组里真实颜色的平均值
            rs = gs = bs = n = 0
            for y in range(y0, min(y1, im.height)):
                for x in range(x0, min(x1, im.width)):
                    r, g, b, a = px[x, y]
                    if a and (r >> 4, g >> 4, b >> 4) == key:
                        rs += r; gs += g; bs += b; n += 1
            opx[ox, oy] = (rs // n, gs // n, bs // n, 255)
    return out


def reduce_palette(im, colors):
    alpha = im.getchannel("A")
    rgb = im.convert("RGB")
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    q.putalpha(alpha.point(lambda a: 255 if a >= 128 else 0))
    return q


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--block", type=float, required=True, help="原图里一个像素块约多少像素")
    ap.add_argument("--colors", type=int, default=16, help="最多保留几种颜色")
    args = ap.parse_args()

    im = Image.open(args.input).convert("RGBA")
    im = clean_alpha(im)
    score, ox, oy = find_offset(im, args.block)
    print(f"网格起点 ({ox:.0f}, {oy:.0f})，格子颜色统一度 {score * 100:.0f}%")
    out = resample(im, args.block, (ox, oy))
    out = reduce_palette(out, args.colors)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    out.save(args.output, optimize=True)
    used = sum(1 for _, c in out.getcolors(maxcolors=1 << 16) if c[3])
    print(f"已生成 {Path(args.output)}：{out.width}×{out.height} 像素，{used} 种颜色，"
          f"{Path(args.output).stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
