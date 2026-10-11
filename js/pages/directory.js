// 目录页（第 3 步实现）
import { el } from "../ui/dom.js";

export function render(container) {
  container.append(
    el("h1", { class: "page-title" }, "目录"),
    el("div", { class: "card" },
      el("p", { class: "muted" }, "Friends 和 Family 的守护蛋会出现在这里。"),
    ),
  );
}
