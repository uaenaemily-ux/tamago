// 通用弹窗：手机上从底部弹出，电脑上居中。
// 用法：const m = openModal({ title: "添加朋友", body: el(...), footer: el(...) }); m.close();
// 点遮罩、按 Esc、点右上角 × 都会关闭。
import { el } from "./dom.js";

export function openModal({ title, body, footer, onClose, dismissible = true }) {
  const root = document.getElementById("modal-root");
  const previousFocus = document.activeElement;

  const titleId = `modal-title-${Date.now()}`;
  const closeBtn = el("button", { class: "modal-close", type: "button", "aria-label": "关闭" }, "×");

  const dialog = el("div", {
    class: "modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": titleId,
  },
    el("div", { class: "modal-header" },
      el("h2", { id: titleId, class: "modal-title" }, title),
      dismissible ? closeBtn : null,
    ),
    el("div", { class: "modal-body" }, body),
    footer ? el("div", { class: "modal-footer" }, footer) : null,
  );
  const backdrop = el("div", { class: "modal-backdrop" }, dialog);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
    if (!root.children.length) document.body.classList.remove("modal-open");
    previousFocus?.focus?.();
    onClose?.();
  }

  function onKey(e) {
    if (e.key === "Escape" && dismissible && root.lastElementChild === backdrop) close();
  }

  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop && dismissible) close();
  });
  document.addEventListener("keydown", onKey);

  root.append(backdrop);
  document.body.classList.add("modal-open");
  // 聚焦弹窗本身（不直接聚焦输入框，免得手机一打开就弹出键盘）
  dialog.setAttribute("tabindex", "-1");
  dialog.focus({ preventScroll: true });

  return { close, dialog };
}
