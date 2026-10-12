"""把一对翅膀的像素图从中间的空隙切成左右两张，方便分别定位、自由控制和蛋的间距。

用法（在项目根目录运行，需要 Pillow）：
    python3 tools/split-wings.py 一对翅膀.png assets/wing-left.png assets/wing-right.png

完整流程（换翅膀素材时）：
    python3 tools/pixelize.py design-refs/wings-raw.png /tmp/wings.png --block 12.5
    python3 tools/split-wings.py /tmp/wings.png assets/wing-left.png assets/wing-right.png

切法：找到图片中间完全透明的那几列作为分界；左右两张只裁掉左右多余的透明列，
上下保持同样的高度，这样两只翅膀按同样比例缩放、垂直位置一致。
"""
import sys

from PIL import Image


def main():
    src, out_left, out_right = sys.argv[1:4]
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    alpha = im.getchannel("A").load()

    def empty(x):
        return all(alpha[x, y] == 0 for y in range(h))

    gap = [x for x in range(w) if empty(x) and abs(x - w // 2) < w // 8]
    if not gap:
        sys.exit("没找到中间的透明空隙，无法切分")
    gap_start, gap_end = gap[0], gap[-1]

    left = im.crop((0, 0, gap_start, h))
    right = im.crop((gap_end + 1, 0, w, h))
    # 只裁左右的透明列，上下保持同样高度
    lb, rb = left.getbbox(), right.getbbox()
    top = min(lb[1], rb[1])
    bottom = max(lb[3], rb[3])
    left = left.crop((lb[0], top, lb[2], bottom))
    right = right.crop((rb[0], top, rb[2], bottom))
    left.save(out_left, optimize=True)
    right.save(out_right, optimize=True)
    print(f"中间空隙：第 {gap_start}–{gap_end} 列")
    print(f"左翅 {out_left}：{left.width}×{left.height}；右翅 {out_right}：{right.width}×{right.height}")


if __name__ == "__main__":
    main()
