"""生成原创像素图标（SVG）：把下面的字符画转成 assets/ 里的 SVG 文件。

用法（在项目根目录运行）：
    python3 tools/pixel-icons.py

想新增或修改图标：改下面的字符画，再运行一次。
每个字符对应一种颜色，"." 表示透明。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def to_svg(art, colors):
    rows = art.strip("\n").split("\n")
    width, height = max(len(r) for r in rows), len(rows)
    paths = {}
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            char = row[x]
            if char == ".":
                x += 1
                continue
            start = x
            while x < len(row) and row[x] == char:
                x += 1
            paths.setdefault(char, []).append(f"M{start} {y}h{x - start}v1h-{x - start}z")
    body = "".join(f'<path fill="{colors[c]}" d="{"".join(p)}"/>' for c, p in paths.items())
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
            f'shape-rendering="crispEdges">{body}</svg>\n')


# ---------- 装饰（彩色） → assets/deco/ ----------
DECO = {
    "pixel-heart": ({"O": "#D9718F", "P": "#F7B8CB", "W": "#FFFFFF"}, """
.OO...OO.
OPPO.OPPO
OPWPOPPPO
OPPPPPPPO
.OPPPPPO.
..OPPPO..
...OPO...
....O....
"""),
    "pixel-star": ({"O": "#E2A93B", "Y": "#FFE38A", "W": "#FFFFFF"}, """
....O....
...OYO...
...OYO...
OOOOYOOOO
.OYYWYYO.
..OYYYO..
..OYOYO..
.OYO.OYO.
.OO...OO.
"""),
    # 礼物盒：礼物墙里没有照片的礼物用它
    "pixel-gift": ({"O": "#C79AB0", "R": "#F7B8CB", "Y": "#FFE38A"}, """
..OO.OO..
.OYYOYYO.
..OOYOO..
OOOOOOOOO
ORRRYRRRO
OOOOOOOOO
.ORRYRRO.
.ORRYRRO.
.ORRYRRO.
.OOOOOOO.
"""),
    # 生日蛋糕：目录页"今天生日"用
    "pixel-cake": ({"O": "#C27B95", "W": "#FFFFFF", "P": "#F7B8CB", "C": "#C9E6F7", "Y": "#FFE38A", "F": "#F5A04A"}, """
.....Y.....
....YFY....
.....C.....
.....C.....
.OOOOOOOOO.
.OWWWWWWWO.
.OWPWWPWWO.
.OPPPPPPPO.
.OPPPPPPPO.
OOOOOOOOOOO
"""),
    # 天使翅膀（右翼）；左翼在 CSS 里水平翻转
    "pixel-wing":({"O": "#C79AB0", "W": "#FFFFFF", "P": "#FCE4EC"}, """
.......OOOO.
.....OOWWWWO
...OOWWWWWO.
.OOWWWWWWWOO
OWWWWWPWWWWO
OWWWWWWWWWO.
.OWWWPWWWWO.
.OWWWWWWWO..
..OWWWPWO...
...OOWWO....
.....OO.....
"""),
}

# ---------- 导航图标（单色，CSS 用 mask 上色） → assets/nav/ ----------
NAV = {
    "egg": """
...XXX...
..XXXXX..
.XX.XXXX.
.XXXXXXX.
XXXXXXXXX
XXXXXXXXX
XXXXXXXXX
XXXXXXXXX
XXXXXXXXX
.XXXXXXX.
..XXXXX..
""",
    "book": """
.XXX...XXX.
X...X.X...X
X.XXX.XXX.X
X...X.X...X
X.XXX.XXX.X
X...X.X...X
X.XXX.XXX.X
X...XXX...X
XXXX...XXXX
""",
    "gear": """
....XXX....
.XX.XXX.XX.
.XXXXXXXXX.
..XXXXXXX..
XXXX...XXXX
XXXX...XXXX
XXXX...XXXX
..XXXXXXX..
.XXXXXXXXX.
.XX.XXX.XX.
....XXX....
""",
}


def main():
    deco_dir = ROOT / "assets" / "deco"
    nav_dir = ROOT / "assets" / "nav"
    deco_dir.mkdir(parents=True, exist_ok=True)
    nav_dir.mkdir(parents=True, exist_ok=True)

    for name, (colors, art) in DECO.items():
        (deco_dir / f"{name}.svg").write_text(to_svg(art, colors))
    for name, art in NAV.items():
        (nav_dir / f"{name}.svg").write_text(to_svg(art, {"X": "#000"}))

    print(f"已生成 {len(DECO)} 个装饰图标、{len(NAV)} 个导航图标")


if __name__ == "__main__":
    main()
