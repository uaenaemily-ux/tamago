// 目录页（第 3 步实现）
import { el } from "../ui/dom.js";

export function render(container) {
  container.append(
    el("h1", { class: "page-title" }, "目录"),
    el("div", { class: "card" },
      el("h2", {}, el("span", { class: "deco deco-star" }), " Friends"),
      el("p", { class: "muted" }, "朋友的守护蛋会出现在这里。"),
    ),
    el("div", { class: "card" },
      el("h2", {}, el("span", { class: "deco deco-heart" }), " Family"),
      el("p", { class: "muted" }, "家人的守护蛋会出现在这里。"),
    ),
  );
}
