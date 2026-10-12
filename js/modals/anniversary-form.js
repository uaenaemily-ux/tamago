// 添加 / 编辑纪念日的弹窗。纪念日存在 person.anniversaries 里，保存时通过 updatePerson 写入。
// 添加：openAnniversaryForm({ person, onSaved })
// 编辑：openAnniversaryForm({ person, anniversary, onSaved })
import { el } from "../ui/dom.js";
import { openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { field, range, datalist } from "../ui/form.js";
import { getPerson, updatePerson } from "../store.js";
import { daysInMonth, toYMD } from "../dates.js";

const NAME_SUGGESTIONS = ["相识纪念日", "第一次见面", "在一起纪念日", "结婚纪念日", "毕业纪念日"];

export function openAnniversaryForm({ person, anniversary = null, onSaved } = {}) {
  const isEdit = Boolean(anniversary);
  const thisYear = toYMD().year;
  const uid = Date.now();

  const nameInput = el("input", {
    class: "input", type: "text", maxlength: 20, autocomplete: "off",
    placeholder: "比如：相识纪念日", value: anniversary?.name || "", list: `anniversary-names-${uid}`,
  });

  const yearSelect = el("select", { class: "input", "aria-label": "年份" },
    el("option", { value: "" }, "年份不详"),
    ...range(thisYear, 1900).map((y) => el("option", { value: y }, `${y} 年`)),
  );
  const monthSelect = el("select", { class: "input", "aria-label": "月" },
    el("option", { value: "" }, "月"),
    ...range(1, 12).map((m) => el("option", { value: m }, `${m} 月`)),
  );
  const daySelect = el("select", { class: "input", "aria-label": "日" });
  yearSelect.value = anniversary?.year ?? "";
  monthSelect.value = anniversary?.month ?? "";

  // 根据年、月更新"日"的选项（2 月 29 日只在闰年或年份不详时出现）
  function refreshDays() {
    const keep = Number(daySelect.value) || anniversary?.day || "";
    const month = Number(monthSelect.value);
    const max = month ? daysInMonth(month, Number(yearSelect.value) || 2000) : 31;
    daySelect.replaceChildren(
      el("option", { value: "" }, "日"),
      ...range(1, max).map((d) => el("option", { value: d }, `${d} 日`)),
    );
    daySelect.value = keep && keep <= max ? keep : "";
  }
  refreshDays();
  yearSelect.addEventListener("change", refreshDays);
  monthSelect.addEventListener("change", refreshDays);

  const errorBox = el("p", { class: "form-error", role: "alert", hidden: true });
  const formId = `anniversary-form-${uid}`;
  const form = el("form", { class: "form", id: formId, novalidate: true },
    errorBox,
    field("名称", nameInput),
    el("div", { class: "field" },
      el("span", { class: "field-label" }, "日期"),
      el("div", { class: "birthday-row" }, yearSelect, monthSelect, daySelect),
      el("span", { class: "field-hint" }, "填了年份，会显示是第几年"),
    ),
    datalist(`anniversary-names-${uid}`, NAME_SUGGESTIONS),
  );

  const cancelBtn = el("button", { class: "btn btn-ghost", type: "button" }, "取消");
  const saveBtn = el("button", { class: "btn btn-primary", type: "submit", form: formId }, "保存");
  const modal = openModal({
    title: isEdit ? "编辑纪念日" : `${person.name} 的纪念日`,
    body: form,
    footer: [cancelBtn, saveBtn],
  });
  cancelBtn.addEventListener("click", () => modal.close());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const entry = {
      id: anniversary?.id,
      name: nameInput.value,
      year: yearSelect.value ? Number(yearSelect.value) : null,
      month: monthSelect.value ? Number(monthSelect.value) : undefined,
      day: daySelect.value ? Number(daySelect.value) : undefined,
    };
    // 用最新数据（页面上可能刚改过别的）
    const current = getPerson(person.id)?.anniversaries || [];
    const list = isEdit ? current.map((a) => (a.id === anniversary.id ? entry : a)) : [...current, entry];

    saveBtn.disabled = true;
    try {
      await updatePerson(person.id, { anniversaries: list });
      modal.close();
      showToast(isEdit ? "已保存" : "纪念日已添加");
      onSaved?.();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      saveBtn.disabled = false;
    }
  });
}
