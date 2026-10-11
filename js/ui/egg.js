// 原创守护蛋：统一造型，只换颜色。
// 造型：蛋形 + 左上高光 + 白色蕾丝花边（带小圆点）+ 两颗小闪光。
// 用法：egg("#F7B8CB", { size: 64 })  → <svg> 元素
import { EGG_COLORS } from "../schema.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const EGG_PATH = "M50 4 C78 4 96 48 96 76 C96 102 75 116 50 116 C25 116 4 102 4 76 C4 48 22 4 50 4 Z";
const SPARKLE = "M0 -6 C0.8 -1.5 1.5 -0.8 6 0 C1.5 0.8 0.8 1.5 0 6 C-0.8 1.5 -1.5 0.8 -6 0 C-1.5 -0.8 -0.8 -1.5 0 -6 Z";

let uid = 0;

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

// 只接受 #RRGGBB，防止把奇怪的字符串写进样式
function safeColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color || "") ? color : EGG_COLORS[0];
}

export function egg(color, { size = 64, className = "" } = {}) {
  const id = `egg-clip-${++uid}`;
  const svg = svgEl("svg", {
    viewBox: "0 0 100 120",
    width: size,
    height: Math.round(size * 1.2),
    class: `egg ${className}`.trim(),
    "aria-hidden": "true",
  });
  svg.style.setProperty("--egg", safeColor(color));

  const clip = svgEl("clipPath", { id });
  clip.append(svgEl("path", { d: EGG_PATH }));
  const defs = svgEl("defs");
  defs.append(clip);

  // 蛋身
  const body = svgEl("path", { d: EGG_PATH, class: "egg-body" });

  // 蕾丝花边：一条白带 + 下沿扇贝 + 带上的小圆点（裁切在蛋形内）
  const lace = svgEl("g", { "clip-path": `url(#${id})`, class: "egg-lace" });
  lace.append(svgEl("rect", { x: 0, y: 62, width: 100, height: 13 }));
  for (let x = 3; x <= 100; x += 8) {
    lace.append(svgEl("circle", { cx: x, cy: 75, r: 4 }));
  }
  const dots = svgEl("g", { "clip-path": `url(#${id})`, class: "egg-dots" });
  for (let x = 10; x <= 92; x += 12) {
    dots.append(svgEl("circle", { cx: x, cy: 68.5, r: 1.8 }));
  }

  // 高光
  const shine = svgEl("ellipse", {
    cx: 31, cy: 36, rx: 8, ry: 15, transform: "rotate(-22 31 36)", class: "egg-shine",
  });

  // 小闪光
  const s1 = svgEl("path", { d: SPARKLE, transform: "translate(72 30)", class: "egg-sparkle" });
  const s2 = svgEl("path", { d: SPARKLE, transform: "translate(80 46) scale(0.6)", class: "egg-sparkle" });

  // 描边放最上面，盖住花边的边缘
  const outline = svgEl("path", { d: EGG_PATH, class: "egg-outline" });

  svg.append(defs, body, lace, dots, shine, s1, s2, outline);
  return svg;
}
