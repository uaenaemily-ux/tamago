// 首页（第 6 步实现生日倒计时）
import { el } from "../ui/dom.js";

export function render(container) {
  container.append(
    el("h1", { class: "page-title" }, "首页"),
    el("div", { class: "card card-sparkles empty" },
      el("div", { class: "angel" },
        el("span", { class: "deco deco-wing deco-wing-left" }),
        el("span", { class: "deco deco-heart" }),
        el("span", { class: "deco deco-wing" }),
      ),
      el("p", {}, "即将过生日的守护蛋会出现在这里。"),
      el("p", { class: "muted" }, "去目录登记第一颗守护蛋吧"),
      el("a", { class: "btn btn-primary", href: "#/directory" }, "去目录"),
    ),
  );
}
