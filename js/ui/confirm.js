// 二次确认框。用法：if (await confirmDialog({ title, message, confirmText: "删除", danger: true })) { ... }
import { el } from "./dom.js";
import { openModal } from "./modal.js";

export function confirmDialog({ title, message, confirmText = "确定", cancelText = "取消", danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const ok = el("button", { class: `btn ${danger ? "btn-danger" : "btn-primary"}`, type: "button" }, confirmText);
    const cancel = el("button", { class: "btn btn-ghost", type: "button" }, cancelText);

    const modal = openModal({
      title,
      body: el("p", { class: "confirm-message" }, message),
      footer: [cancel, ok],
      onClose: () => resolve(result),
    });

    ok.addEventListener("click", () => {
      result = true;
      modal.close();
    });
    cancel.addEventListener("click", () => modal.close());
    ok.focus();
  });
}
