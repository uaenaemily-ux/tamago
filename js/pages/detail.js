// 详情页（第 3 步先做编辑 / 删除，第 4 步补全基础信息和标签，第 5 步加礼物墙）
import { el } from "../ui/dom.js";
import { egg } from "../ui/egg.js";
import { confirmDialog } from "../ui/confirm.js";
import { showToast } from "../ui/toast.js";
import { getPerson, listGifts, deletePerson } from "../store.js";
import { openFriendForm } from "../modals/friend-form.js";
import { refresh } from "../router.js";

// 底部导航高亮"目录"
export const navSection = "directory";

export function render(container, { id }) {
  const person = getPerson(id);
  if (!person) {
    container.append(
      el("h1", { class: "page-title" }, "找不到"),
      el("div", { class: "card empty" },
        el("p", {}, "这颗守护蛋不存在，可能已经被删除了。"),
        el("a", { class: "btn btn-primary", href: "#/directory" }, "回到目录"),
      ),
    );
    return;
  }

  container.append(
    el("a", { class: "back-link", href: "#/directory" }, "‹ 目录"),
    el("div", { class: "card card-sparkles detail-head" },
      egg(person.eggColor, { size: 96 }),
      el("h1", { class: "detail-name" }, person.name),
      el("div", { class: "detail-actions" },
        el("button", {
          class: "btn btn-small", type: "button",
          onClick: () => openFriendForm({ person, onSaved: () => refresh() }),
        }, "编辑"),
        el("button", {
          class: "btn btn-small btn-ghost", type: "button",
          onClick: () => remove(person),
        }, "删除"),
      ),
    ),
    el("div", { class: "card" },
      el("p", { class: "muted" }, "生日、星座、喜好标签和礼物墙会放在这里。"),
    ),
  );
}

async function remove(person) {
  const giftCount = listGifts(person.id).length;
  const ok = await confirmDialog({
    title: `删除 ${person.name}？`,
    message: giftCount
      ? `TA 的 ${giftCount} 件礼物记录和照片也会一起删除，删除后无法恢复。`
      : "删除后无法恢复。",
    confirmText: "删除",
    danger: true,
  });
  if (!ok) return;

  try {
    await deletePerson(person.id);
    showToast(`已删除 ${person.name}`);
    location.hash = "#/directory";
  } catch (err) {
    showToast(err.message);
  }
}
