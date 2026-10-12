// 喜好标签编辑器：输入框 + "添加"按钮 + 可删除的标签列表。
// 登记弹窗和详情页共用。
//
// const editor = tagEditor({ tags, onChange: async (tags) => { ...保存... } });
// container.append(editor.element);
// editor.flush();     // 把输入框里还没点"添加"的文字也加进去
// editor.getTags();   // 当前标签
//
// onChange 抛出错误时，标签会恢复原样并弹出提示。
import { el } from "./dom.js";
import { showToast } from "./toast.js";
import { cleanTags } from "../store.js";

export function tagEditor({ tags = [], onChange, placeholder = "比如：芭蕾风、Jellycat、最近在学滑雪" } = {}) {
  let current = [...tags];

  const list = el("div", { class: "chips" });
  const input = el("input", {
    class: "input", type: "text", maxlength: 20, autocomplete: "off", placeholder,
    "aria-label": "新的喜好标签",
  });
  const addBtn = el("button", { class: "btn btn-small", type: "button" }, "添加");

  function render() {
    list.replaceChildren(...current.map((tag) =>
      el("span", { class: "chip" }, tag,
        el("button", {
          class: "chip-remove", type: "button", "aria-label": `删除标签 ${tag}`,
          onClick: () => update(current.filter((t) => t !== tag)),
        }, "×"),
      )));
  }

  async function update(next) {
    const previous = current;
    current = next;
    render();
    try {
      await onChange?.(current);
    } catch (err) {
      current = previous;
      render();
      showToast(err.message);
    }
  }

  // 支持一次输入多个，用逗号、顿号或空格分隔
  function flush() {
    const parts = input.value.split(/[,，、\s]+/);
    input.value = "";
    const next = cleanTags([...current, ...parts]);
    if (next.length !== current.length) return update(next);
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault(); // 回车添加标签，而不是提交表单
      flush();
    }
  });
  addBtn.addEventListener("click", () => flush());
  render();

  const element = el("div", { class: "tag-editor" },
    el("div", { class: "tag-entry" }, input, addBtn),
    list,
  );

  return { element, flush, getTags: () => current };
}
