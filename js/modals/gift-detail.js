// 查看一件礼物：大图 + 名称、品类、日期、场合、对方反应；可编辑、删除。
import { el } from "../ui/dom.js";
import { openModal } from "../ui/modal.js";
import { confirmDialog } from "../ui/confirm.js";
import { showToast } from "../ui/toast.js";
import { photoImg } from "../photos.js";
import { getGift, deleteGift } from "../store.js";
import { parseISODate } from "../dates.js";
import { openGiftForm } from "./gift-form.js";

export function openGiftDetail(giftId, { onChanged } = {}) {
  const gift = getGift(giftId);
  if (!gift) return;

  const date = parseISODate(gift.date);
  const rows = [
    ["品类", gift.category],
    ["日期", date ? `${date.year}年${date.month}月${date.day}日` : ""],
    ["场合", gift.occasion],
    ["来源", gift.source === "ai" ? "灵感孵化" : ""],
  ].filter(([, value]) => value);

  const editBtn = el("button", { class: "btn btn-small", type: "button" }, "编辑");
  const deleteBtn = el("button", { class: "btn btn-small btn-ghost", type: "button" }, "删除");

  const modal = openModal({
    title: gift.name,
    body: el("div", { class: "gift-detail" },
      gift.photoId
        ? photoImg(gift.photoId, { alt: gift.name, className: "gift-detail-photo" })
        : el("div", { class: "gift-detail-photo gift-detail-nophoto" }, el("span", { class: "deco deco-gift" })),
      rows.length ? el("dl", { class: "info-list" },
        ...rows.map(([label, value]) =>
          el("div", { class: "info-row" }, el("dt", {}, label), el("dd", {}, value))),
      ) : null,
      gift.reaction
        ? el("div", { class: "gift-reaction" }, el("span", { class: "field-label" }, "对方反应"), el("p", {}, gift.reaction))
        : null,
    ),
    footer: [deleteBtn, editBtn],
  });

  editBtn.addEventListener("click", () => {
    modal.close();
    openGiftForm({ gift: getGift(gift.id), onSaved: onChanged });
  });

  deleteBtn.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: `删除「${gift.name}」？`,
      message: gift.photoId ? "照片也会一起删除，删除后无法恢复。" : "删除后无法恢复。",
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteGift(gift.id);
      modal.close();
      showToast("已删除");
      onChanged?.();
    } catch (err) {
      showToast(err.message);
    }
  });
}
