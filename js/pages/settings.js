// 设置页（第 8 步实现）
import { el } from "../ui/dom.js";

export function render(container) {
  container.append(
    el("h1", { class: "page-title" }, "设置"),
    el("div", { class: "card" },
      el("p", { class: "muted" }, "API 密钥、导出/导入备份会放在这里。"),
    ),
  );
}
