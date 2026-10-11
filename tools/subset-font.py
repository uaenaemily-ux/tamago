"""截取标题字体：只保留网页里用到的字，输出 fonts/tamago-title.woff2。

用法（在项目根目录运行）：
    .venv/bin/python tools/subset-font.py

新增或修改了界面文案后，重新运行一次即可。

授权说明：原字体「秋叶圆体 16」使用 SIL OFL 1.1，作者声明了保留名称
「秋叶圆体 16」「QiuYeYuanTi 16」。截取属于修改，所以输出的字体必须改名，
这里改为 "Tamago Title"，并保留原版权信息。授权全文见 fonts/OFL.txt。
"""
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "fonts" / "QiuYeYuanTi-16.ttf"
OUTPUT = ROOT / "fonts" / "tamago-title.woff2"
NEW_NAME = "Tamago Title"

# 从这些文件里收集用到的字
SCAN = [ROOT / "index.html", *sorted((ROOT / "js").rglob("*.js"))]
SKIP_DIRS = {"vendor"}

# 无论文案里有没有，都保留的字符：英文、数字、常用标点、¥
ALWAYS = "".join(chr(c) for c in range(0x20, 0x7F)) + "¥·…—–，。、！？：；“”‘’（）《》「」【】～"


# JS 里只收集字符串（"..."、'...'、`...`）中的字，注释里的字不需要
JS_STRING = re.compile(r'"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\'|`(?:[^`\\]|\\.)*`', re.S)
HTML_COMMENT = re.compile(r"<!--.*?-->", re.S)


def collect_text():
    chars = set(ALWAYS)
    for path in SCAN:
        if SKIP_DIRS & set(path.relative_to(ROOT).parts):
            continue
        source = path.read_text(encoding="utf-8")
        if path.suffix == ".js":
            chars.update("".join(JS_STRING.findall(source)))
        else:
            chars.update(HTML_COMMENT.sub("", source))
    # 去掉换行等控制字符
    return "".join(sorted(c for c in chars if c.isprintable()))


def rename(font):
    """改掉保留名称（OFL 要求），保留版权（ID 0）和授权信息（ID 13、14）。"""
    name = font["name"]
    new_values = {
        1: NEW_NAME,                 # 字体家族名
        3: f"{NEW_NAME};subset",     # 唯一标识
        4: NEW_NAME,                 # 完整名称
        6: NEW_NAME.replace(" ", ""),  # PostScript 名称
    }
    for record in list(name.names):
        if record.nameID in new_values:
            name.removeNames(nameID=record.nameID)
    for name_id, value in new_values.items():
        name.setName(value, name_id, 3, 1, 0x409)
    name.setName(
        f"Modified (subset) from QiuYeYuanTi 16 for tamago. Original: https://github.com/yzdnn/QiuYeYuanTi-16",
        10, 3, 1, 0x409,
    )


def main():
    text = collect_text()

    options = subset.Options()
    options.flavor = "woff2"
    options.name_IDs = ["*"]          # 保留版权和授权信息
    options.name_languages = ["*"]
    options.drop_tables += ["bdat", "bloc", "prop"]  # 苹果专用的点阵表，网页用不到
    options.layout_features = ["*"]

    font = TTFont(SOURCE)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    rename(font)
    font.flavor = "woff2"
    font.save(OUTPUT)

    cjk = sum(1 for c in text if ord(c) > 0x2E80)
    size_kb = OUTPUT.stat().st_size / 1024
    print(f"收集到 {len(text)} 个字符（其中中文 {cjk} 个）")
    print(f"已生成 {OUTPUT.relative_to(ROOT)}，大小 {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
