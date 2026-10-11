// 底部的短暂提示条。用法：showToast("已保存")
import { el } from "./dom.js";

let current = null;

export function showToast(message, { duration = 2400 } = {}) {
  current?.remove();
  const toast = el("div", { class: "toast", role: "status" }, message);
  document.body.append(toast);
  current = toast;
  setTimeout(() => {
    toast.classList.add("toast-hide");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
