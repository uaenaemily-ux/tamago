// 表单小工具，弹窗表单共用
import { el } from "./dom.js";

// 带标签的输入项
export function field(label, input) {
  return el("label", { class: "field" }, el("span", { class: "field-label" }, label), input);
}

// 输入框下拉建议：返回 <datalist>，输入框设置 list 属性指向它
export function datalist(id, options) {
  return el("datalist", { id }, ...options.map((value) => el("option", { value })));
}

// range(1, 3) → [1, 2, 3]；range(3, 1) → [3, 2, 1]
export function range(from, to) {
  const step = from <= to ? 1 : -1;
  const result = [];
  for (let i = from; step > 0 ? i <= to : i >= to; i += step) result.push(i);
  return result;
}
