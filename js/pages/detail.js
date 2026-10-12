// 详情页：头部（名字、年龄、蛋、生日、星座、倒计时）+ 喜好标签 + 礼物墙 + 灵感孵化（第 9 步）
import { el } from "../ui/dom.js";
import { egg } from "../ui/egg.js";
import { confirmDialog } from "../ui/confirm.js";
import { showToast } from "../ui/toast.js";
import { tagEditor } from "../ui/tag-editor.js";
import { getPerson, listGifts, deletePerson, updatePerson } from "../store.js";
import { getAge, getZodiac, formatBirthday, nextBirthday } from "../dates.js";
import { openFriendForm } from "../modals/friend-form.js";
import { openGiftForm } from "../modals/gift-form.js";
import { openGiftDetail } from "../modals/gift-detail.js";
import { photoImg } from "../photos.js";
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
    header(person),
    tagsCard(person),
    giftWall(person),
    el("section", { class: "card incubator-card" },
      el("h2", {}, el("span", { class: "deco deco-star" }), " 灵感孵化"),
      el("p", { class: "muted" }, "根据 TA 的喜好和送礼记录，孵化两个礼物方案。"),
      el("button", { class: "btn btn-primary", type: "button", disabled: true }, "Start（即将开放）"),
    ),
  );
}

// ---------- 头部 ----------
function header(person) {
  const age = getAge(person.birthday);
  const next = nextBirthday(person.birthday);

  return el("section", { class: "card card-sparkles detail-head" },
    egg(person.eggColor, { size: 96 }),
    el("h1", { class: "detail-name" },
      person.name,
      age != null ? el("span", { class: "detail-age num" }, `（${age}）`) : null,
    ),
    el("p", { class: "countdown" }, countdownText(next)),
    el("dl", { class: "info-list" },
      infoRow("生日", formatBirthday(person.birthday)),
      infoRow("星座", getZodiac(person.birthday)),
      infoRow("分类", person.category === "family" ? "家人" : "朋友"),
    ),
    el("div", { class: "detail-actions" },
      el("button", {
        class: "btn btn-small", type: "button",
        // 每次都取最新数据（标签可能刚在页面上改过）
        onClick: () => openFriendForm({ person: getPerson(person.id), onSaved: () => refresh() }),
      }, "编辑"),
      el("button", {
        class: "btn btn-small btn-ghost", type: "button",
        onClick: () => remove(getPerson(person.id)),
      }, "删除"),
    ),
  );
}

function countdownText({ daysUntil, turningAge }) {
  if (daysUntil === 0) {
    return turningAge != null ? `今天是 TA 的 ${turningAge} 岁生日！` : "今天是 TA 的生日！";
  }
  return turningAge != null
    ? `还有 ${daysUntil} 天满 ${turningAge} 岁`
    : `还有 ${daysUntil} 天过生日`;
}

function infoRow(label, value) {
  return el("div", { class: "info-row" }, el("dt", {}, label), el("dd", {}, value));
}

// ---------- 喜好标签：直接在详情页增删，改完立即保存 ----------
function tagsCard(person) {
  const hint = el("p", { class: "muted" }, "还没有喜好标签。聊天时听到 TA 的新喜好，随手记在这里吧。");
  hint.hidden = person.tags.length > 0;

  const editor = tagEditor({
    tags: person.tags,
    onChange: async (tags) => {
      await updatePerson(person.id, { tags });
      hint.hidden = tags.length > 0;
    },
  });

  return el("section", { class: "card" },
    el("h2", {}, el("span", { class: "deco deco-sparkle" }), " 喜好标签"),
    hint,
    editor.element,
  );
}

// ---------- 礼物墙：圆形照片，从新到旧；末尾"+" ----------
function giftWall(person) {
  const gifts = listGifts(person.id);

  const tiles = gifts.map((gift) =>
    el("button", {
      class: "gift-tile", type: "button",
      onClick: () => openGiftDetail(gift.id, { onChanged: () => refresh() }),
    },
      el("span", { class: "gift-circle" },
        gift.photoId
          ? photoImg(gift.photoId, { alt: "" })
          : el("span", { class: "deco deco-gift" }),
      ),
      el("span", { class: "gift-name" }, gift.name),
      gift.date ? el("span", { class: "gift-year num" }, gift.date.slice(0, 4)) : null,
    ));

  const addTile = el("button", {
    class: "gift-tile", type: "button", "aria-label": "添加礼物",
    onClick: () => openGiftForm({ personId: person.id, onSaved: () => refresh() }),
  },
    el("span", { class: "gift-circle gift-circle-add", "aria-hidden": "true" }, "+"),
    el("span", { class: "gift-name" }, "添加"),
  );

  return el("section", { class: "card" },
    el("h2", { class: "section-title" },
      el("span", { class: "deco deco-heart" }), " 礼物墙",
      el("span", { class: "count num" }, String(gifts.length)),
    ),
    gifts.length ? null : el("p", { class: "muted" }, "还没有送礼记录。送出礼物后记在这里，以后就不怕忘啦。"),
    el("div", { class: "gift-grid" }, ...tiles, addTile),
  );
}

// ---------- 删除 ----------
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
