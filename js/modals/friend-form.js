// 添加 / 编辑朋友的弹窗。
// 添加：openFriendForm({ category: "friend", onSaved })
// 编辑：openFriendForm({ person, onSaved })
// 添加时可选填"最近一次送的礼物"，保存后写入礼物墙。
import { el } from "../ui/dom.js";
import { openModal } from "../ui/modal.js";
import { egg } from "../ui/egg.js";
import { showToast } from "../ui/toast.js";
import { addPerson, updatePerson, addGift, cleanTags } from "../store.js";
import { EGG_COLORS } from "../schema.js";
import { daysInMonth, toYMD, todayISO } from "../dates.js";

export function openFriendForm({ person = null, category = "friend", onSaved } = {}) {
  const isEdit = Boolean(person);
  const thisYear = toYMD().year;

  // ---------- 表单状态 ----------
  let eggColor = person?.eggColor || EGG_COLORS[Math.floor(Math.random() * EGG_COLORS.length)];
  let tags = [...(person?.tags || [])];

  // ---------- 名字 ----------
  const nameInput = el("input", {
    class: "input", type: "text", maxlength: 30, autocomplete: "off",
    placeholder: "比如：Mary", value: person?.name || "",
  });

  // ---------- 分类 ----------
  const currentCategory = person?.category || category;
  const categoryField = el("div", { class: "segmented", role: "radiogroup", "aria-label": "分类" },
    ...[["friend", "朋友 Friends"], ["family", "家人 Family"]].map(([value, label]) =>
      el("label", { class: "segmented-item" },
        el("input", { type: "radio", name: "category", value, checked: value === currentCategory }),
        el("span", {}, label),
      )),
  );

  // ---------- 生日 ----------
  const yearSelect = el("select", { class: "input", "aria-label": "出生年份" },
    el("option", { value: "" }, "年份不详"),
    ...range(thisYear, 1900).map((y) => el("option", { value: y }, `${y} 年`)),
  );
  const monthSelect = el("select", { class: "input", "aria-label": "月" },
    el("option", { value: "" }, "月"),
    ...range(1, 12).map((m) => el("option", { value: m }, `${m} 月`)),
  );
  const daySelect = el("select", { class: "input", "aria-label": "日" });

  yearSelect.value = person?.birthday.year ?? "";
  monthSelect.value = person?.birthday.month ?? "";

  // 根据年、月更新"日"的选项（2 月 29 日只在闰年或年份不详时出现）
  function refreshDays() {
    const keep = Number(daySelect.value) || person?.birthday.day || "";
    const month = Number(monthSelect.value);
    const year = Number(yearSelect.value) || 2000;
    const max = month ? daysInMonth(month, year) : 31;
    daySelect.replaceChildren(
      el("option", { value: "" }, "日"),
      ...range(1, max).map((d) => el("option", { value: d }, `${d} 日`)),
    );
    daySelect.value = keep && keep <= max ? keep : "";
  }
  refreshDays();
  yearSelect.addEventListener("change", refreshDays);
  monthSelect.addEventListener("change", refreshDays);

  // ---------- 蛋的颜色 ----------
  const preview = el("div", { class: "egg-preview" });
  function refreshPreview() {
    preview.replaceChildren(egg(eggColor, { size: 72 }));
  }
  refreshPreview();

  const swatches = el("div", { class: "swatches", role: "radiogroup", "aria-label": "蛋的颜色" },
    ...EGG_COLORS.map((color, i) => {
      const input = el("input", {
        type: "radio", name: "eggColor", value: color, checked: color === eggColor,
        "aria-label": `颜色 ${i + 1}`,
      });
      input.addEventListener("change", () => {
        eggColor = color;
        refreshPreview();
      });
      // 直接设置背景色（不用 CSS 变量），兼容性最好
      return el("label", { class: "swatch", style: { backgroundColor: color } }, input);
    }),
  );

  // ---------- 喜好标签 ----------
  const tagList = el("div", { class: "chips" });
  const tagInput = el("input", {
    class: "input", type: "text", maxlength: 20, autocomplete: "off",
    placeholder: "比如：芭蕾风、Jellycat、最近在学滑雪",
  });
  const tagAddBtn = el("button", { class: "btn btn-small", type: "button" }, "添加");

  function renderTags() {
    tagList.replaceChildren(...tags.map((tag) =>
      el("span", { class: "chip" }, tag,
        el("button", {
          class: "chip-remove", type: "button", "aria-label": `删除标签 ${tag}`,
          onClick: () => { tags = tags.filter((t) => t !== tag); renderTags(); },
        }, "×"),
      )));
  }
  function addTagFromInput() {
    // 支持一次输入多个，用逗号、顿号或空格分隔
    const parts = tagInput.value.split(/[,，、\s]+/);
    tags = cleanTags([...tags, ...parts]);
    tagInput.value = "";
    renderTags();
  }
  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault(); // 回车添加标签，而不是提交表单
      addTagFromInput();
    }
  });
  tagAddBtn.addEventListener("click", addTagFromInput);
  renderTags();

  // ---------- 最近一次送的礼物（仅添加时） ----------
  const gift = {
    name: el("input", { class: "input", type: "text", maxlength: 40, placeholder: "比如：芭蕾舞鞋挂件" }),
    category: el("input", { class: "input", type: "text", maxlength: 20, placeholder: "比如：饰品" }),
    date: el("input", { class: "input", type: "date", max: todayISO() }),
    occasion: el("input", { class: "input", type: "text", maxlength: 20, placeholder: "比如：生日" }),
  };
  const giftSection = isEdit ? null : el("details", { class: "form-details" },
    el("summary", {}, "最近一次送的礼物（选填）"),
    field("礼物名称", gift.name),
    el("div", { class: "form-row" }, field("品类", gift.category), field("场合", gift.occasion)),
    field("日期", gift.date),
    el("p", { class: "muted" }, "填了会自动记到礼物墙，照片之后可以在礼物墙补充。"),
  );

  // ---------- 组装 ----------
  const errorBox = el("p", { class: "form-error", role: "alert", hidden: true });

  const form = el("form", { class: "form", novalidate: true },
    errorBox,
    el("div", { class: "form-egg" }, preview, swatches),
    field("名字", nameInput),
    el("div", { class: "field" }, el("span", { class: "field-label" }, "分类"), categoryField),
    el("div", { class: "field" },
      el("span", { class: "field-label" }, "生日"),
      el("div", { class: "birthday-row" }, yearSelect, monthSelect, daySelect),
      el("span", { class: "field-hint" }, "不知道出生年份可以不选，不会显示年龄"),
    ),
    el("div", { class: "field" },
      el("span", { class: "field-label" }, "喜好标签"),
      el("div", { class: "tag-entry" }, tagInput, tagAddBtn),
      tagList,
    ),
    giftSection,
  );

  const cancelBtn = el("button", { class: "btn btn-ghost", type: "button" }, "取消");
  const saveBtn = el("button", { class: "btn btn-primary", type: "submit" }, isEdit ? "保存" : "登记");
  // 保存按钮在弹窗底部，用 form 属性关联到表单
  const formId = `friend-form-${Date.now()}`;
  form.id = formId;
  saveBtn.setAttribute("form", formId);

  const modal = openModal({
    title: isEdit ? "编辑守护蛋" : "登记守护蛋",
    body: form,
    footer: [cancelBtn, saveBtn],
  });
  cancelBtn.addEventListener("click", () => modal.close());

  // ---------- 保存 ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (tagInput.value.trim()) addTagFromInput(); // 输入框里还没点"添加"的标签也算上

    const fields = {
      name: nameInput.value,
      category: form.querySelector('input[name="category"]:checked')?.value,
      birthday: {
        year: yearSelect.value ? Number(yearSelect.value) : null,
        month: monthSelect.value ? Number(monthSelect.value) : undefined,
        day: daySelect.value ? Number(daySelect.value) : undefined,
      },
      eggColor,
      tags,
    };

    // 填了礼物的其他项却没填名称，提醒一下
    const giftName = gift.name.value.trim();
    const giftOther = [gift.category, gift.date, gift.occasion].some((i) => i.value.trim());
    if (!isEdit && !giftName && giftOther) {
      showError("请填写礼物名称，或清空礼物信息");
      giftSection.open = true;
      return;
    }

    saveBtn.disabled = true;
    try {
      const saved = isEdit ? await updatePerson(person.id, fields) : await addPerson(fields);

      if (!isEdit && giftName) {
        try {
          await addGift({
            personId: saved.id,
            name: giftName,
            category: gift.category.value,
            date: gift.date.value,
            occasion: gift.occasion.value,
          });
        } catch (err) {
          showToast(`守护蛋已登记，但礼物没存上：${err.message}`);
        }
      }

      modal.close();
      showToast(isEdit ? "已保存" : `${saved.name} 的守护蛋登记好啦`);
      onSaved?.(saved);
    } catch (err) {
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

// 带标签的输入项
function field(label, input) {
  return el("label", { class: "field" }, el("span", { class: "field-label" }, label), input);
}

// range(1, 3) → [1, 2, 3]；range(3, 1) → [3, 2, 1]
function range(from, to) {
  const step = from <= to ? 1 : -1;
  const result = [];
  for (let i = from; step > 0 ? i <= to : i >= to; i += step) result.push(i);
  return result;
}
