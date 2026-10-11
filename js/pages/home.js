// 首页（第 6 步实现生日倒计时）
import { el } from "../ui/dom.js";

export function render(container) {
  container.append(
    el("h1", { class: "page-title" }, "首页"),
    el("div", { class: "card" },
      el("p", { class: "muted" }, "即将过生日的守护蛋会出现在这里。"),
    ),
  );
}
