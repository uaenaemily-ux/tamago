// 安全地创建页面元素。
// 用法：el("p", { class: "muted" }, "你好", otherElement)
// 文字内容一律变成纯文本节点，不会被当成代码执行（见 CLAUDE.md「安全」）。
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (typeof value === "function" && key.startsWith("on")) {
      // onClick → click 事件
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      node.className = value;
    } else if (key === "style" && typeof value === "object") {
      for (const [prop, v] of Object.entries(value)) {
        // CSS 变量（--xxx）只能用 setProperty 设置
        if (prop.startsWith("--")) node.style.setProperty(prop, v);
        else node.style[prop] = v;
      }
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }

  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}
