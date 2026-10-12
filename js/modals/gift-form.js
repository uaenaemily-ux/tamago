// 添加 / 编辑礼物的弹窗。
// 添加：openGiftForm({ personId, onSaved })
// 编辑：openGiftForm({ gift, onSaved })
// 照片选填：选好后先在本地压缩，点"保存"时才存进去。
import { el } from "../ui/dom.js";
import { openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { field, datalist } from "../ui/form.js";
import { compressImage, photoImg } from "../photos.js";
import {
  addGift, updateGift, savePhoto, deletePhoto, getPerson,
  suggestGiftCategories, suggestOccasions,
} from "../store.js";
import { todayISO } from "../dates.js";

export function openGiftForm({ personId, gift = null, onSaved } = {}) {
  const isEdit = Boolean(gift);
  const ownerId = gift?.personId || personId;
  const owner = getPerson(ownerId);
  const uid = Date.now();

  // ---------- 文字信息 ----------
  const inputs = {
    name: el("input", {
      class: "input", type: "text", maxlength: 40, autocomplete: "off",
      placeholder: "比如：芭蕾舞鞋挂件", value: gift?.name || "",
    }),
    category: el("input", {
      class: "input", type: "text", maxlength: 20, autocomplete: "off",
      placeholder: "比如：饰品", value: gift?.category || "", list: `gift-categories-${uid}`,
    }),
    occasion: el("input", {
      class: "input", type: "text", maxlength: 20, autocomplete: "off",
      placeholder: "比如：生日", value: gift?.occasion || "", list: `gift-occasions-${uid}`,
    }),
    date: el("input", {
      class: "input", type: "date", max: todayISO(),
      value: isEdit ? gift.date || "" : todayISO(),
    }),
    reaction: el("textarea", {
      class: "input", rows: 3, maxlength: 200,
      placeholder: "比如：超喜欢，第二天就挂在包上了",
    }, gift?.reaction || ""),
  };

  // ---------- 照片 ----------
  // photo 的状态：{ kind: "saved", id } 已有照片 / { kind: "new", dataUrl } 新选的 / null 没有照片
  let photo = gift?.photoId ? { kind: "saved", id: gift.photoId } : null;

  const fileInput = el("input", { type: "file", accept: "image/*", class: "visually-hidden" });
  const photoPreview = el("div", { class: "photo-preview" });
  const pickBtn = el("button", { class: "btn btn-small", type: "button" });
  const removeBtn = el("button", { class: "btn btn-small btn-ghost", type: "button" }, "移除照片");
  const photoStatus = el("p", { class: "field-hint", role: "status" });

  function renderPhoto() {
    if (!photo) {
      photoPreview.replaceChildren(el("span", { class: "deco deco-gift photo-empty" }));
    } else if (photo.kind === "saved") {
      photoPreview.replaceChildren(photoImg(photo.id, { alt: "礼物照片" }));
    } else {
      photoPreview.replaceChildren(el("img", { src: photo.dataUrl, alt: "礼物照片" }));
    }
    pickBtn.textContent = photo ? "换一张" : "选择照片";
    removeBtn.hidden = !photo;
  }
  renderPhoto();

  pickBtn.addEventListener("click", () => fileInput.click());
  removeBtn.addEventListener("click", () => {
    photo = null;
    photoStatus.textContent = "";
    renderPhoto();
  });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = ""; // 允许再次选择同一张
    if (!file) return;
    photoStatus.textContent = "正在压缩…";
    pickBtn.disabled = true;
    try {
      const dataUrl = await compressImage(file);
      photo = { kind: "new", dataUrl };
      photoStatus.textContent = `已压缩到 ${Math.round((dataUrl.length * 0.75) / 1024)} KB`;
      renderPhoto();
    } catch (err) {
      photoStatus.textContent = err.message;
    } finally {
      pickBtn.disabled = false;
    }
  });

  // ---------- 组装 ----------
  const errorBox = el("p", { class: "form-error", role: "alert", hidden: true });
  const formId = `gift-form-${uid}`;
  const form = el("form", { class: "form", id: formId, novalidate: true },
    errorBox,
    el("div", { class: "field" },
      el("span", { class: "field-label" }, "照片（选填）"),
      el("div", { class: "photo-field" },
        photoPreview,
        el("div", { class: "photo-actions" }, pickBtn, removeBtn, photoStatus),
      ),
      fileInput,
    ),
    field("礼物名称", inputs.name),
    el("div", { class: "form-row" }, field("品类", inputs.category), field("场合", inputs.occasion)),
    field("日期", inputs.date),
    field("对方反应", inputs.reaction),
    datalist(`gift-categories-${uid}`, suggestGiftCategories()),
    datalist(`gift-occasions-${uid}`, suggestOccasions()),
  );

  const cancelBtn = el("button", { class: "btn btn-ghost", type: "button" }, "取消");
  const saveBtn = el("button", { class: "btn btn-primary", type: "submit", form: formId }, "保存");

  const modal = openModal({
    title: isEdit ? "编辑礼物" : `送给 ${owner?.name ?? "TA"} 的礼物`,
    body: form,
    footer: [cancelBtn, saveBtn],
  });
  cancelBtn.addEventListener("click", () => modal.close());

  // ---------- 保存 ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    if (!inputs.name.value.trim()) {
      showError("请填写礼物名称");
      return;
    }

    saveBtn.disabled = true;
    let newPhotoId = null;
    try {
      // 1. 新照片先存起来
      if (photo?.kind === "new") newPhotoId = await savePhoto(photo.dataUrl);
      const photoId = newPhotoId || (photo?.kind === "saved" ? photo.id : null);

      // 2. 再保存礼物（编辑时如果换了或移除照片，store 会删掉旧照片）
      const fields = {
        personId: ownerId,
        name: inputs.name.value,
        category: inputs.category.value,
        occasion: inputs.occasion.value,
        date: inputs.date.value,
        reaction: inputs.reaction.value,
        photoId,
      };
      const saved = isEdit ? await updateGift(gift.id, fields) : await addGift(fields);

      modal.close();
      showToast(isEdit ? "已保存" : "已加到礼物墙");
      onSaved?.(saved);
    } catch (err) {
      // 礼物没存上，刚存的照片也删掉，免得占空间
      if (newPhotoId) await deletePhoto(newPhotoId).catch(() => {});
      showError(err.message);
      saveBtn.disabled = false;
    }
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
