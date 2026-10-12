// 设置页：AI 设置、导出 / 导入备份、数据安全、示例数据
import { el } from "../ui/dom.js";
import { showToast } from "../ui/toast.js";
import { confirmDialog } from "../ui/confirm.js";
import {
  getState, updateSettings, hasSampleData, clearSampleData, checkPersisted, estimateUsage, isStandalone,
} from "../store.js";
import { APP_VERSION } from "../version.js";
import { exportBackup, readBackupFile, importBackup } from "../backup.js";
import { DEFAULT_MODEL } from "../schema.js";
import { diffDays, toYMD } from "../dates.js";
import { refresh } from "../router.js";

export function render(container) {
  // 注意：浏览器的 append 会把 null 显示成文字 "null"，所以先过滤掉
  container.append(...[
    el("h1", { class: "page-title" }, "设置"),
    aiCard(),
    backupCard(),
    safetyCard(),
    hasSampleData() ? sampleCard() : null,
    versionLine(),
  ].filter(Boolean));
}

// ---------- AI 设置 ----------
function aiCard() {
  const { apiKey, model } = getState().settings;

  const keyInput = el("input", {
    class: "input", type: "password", autocomplete: "off", spellcheck: "false",
    placeholder: "sk-ant-…", value: apiKey, "aria-label": "API 密钥",
  });
  const toggle = el("button", { class: "btn btn-small btn-ghost", type: "button" }, "显示");
  toggle.addEventListener("click", () => {
    const show = keyInput.type === "password";
    keyInput.type = show ? "text" : "password";
    toggle.textContent = show ? "隐藏" : "显示";
  });

  const modelInput = el("input", {
    class: "input", type: "text", autocomplete: "off", spellcheck: "false",
    placeholder: DEFAULT_MODEL, value: model === DEFAULT_MODEL ? "" : model, "aria-label": "模型",
  });

  const status = el("p", { class: "field-hint", role: "status" }, keyStatus(apiKey));
  const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, "保存");
  saveBtn.addEventListener("click", async () => {
    const key = keyInput.value.trim();
    const newModel = modelInput.value.trim() || DEFAULT_MODEL;
    try {
      await updateSettings({ apiKey: key, model: newModel });
      status.textContent = keyStatus(key);
      showToast(key ? "已保存" : "已清除密钥");
    } catch (err) {
      showToast(err.message);
    }
  });

  return el("section", { class: "card" },
    el("h2", {}, el("span", { class: "deco deco-star" }), " AI 灵感孵化"),
    el("p", { class: "muted" }, "灵感孵化会用你自己的 Anthropic API 密钥，从这台设备直接请求 Claude。"),
    el("div", { class: "field" },
      el("span", { class: "field-label" }, "API 密钥"),
      el("div", { class: "tag-entry" }, keyInput, toggle),
      status,
    ),
    el("label", { class: "field" },
      el("span", { class: "field-label" }, `模型（留空使用默认 ${DEFAULT_MODEL}）`),
      modelInput,
    ),
    el("ul", { class: "tips" },
      el("li", {}, "密钥只保存在这台设备的浏览器里，不会上传，也不会放进备份文件。"),
      el("li", {}, "孵化时只发送朋友的文字信息（标签、送礼记录等），不发送照片。"),
      el("li", {}, "调用 API 会按用量收费，费用由你的 Anthropic 账户承担。"),
    ),
    el("div", { class: "card-actions" }, saveBtn),
  );
}

function keyStatus(key) {
  if (!key) return "还没有填写密钥，填写后才能使用灵感孵化。";
  if (!key.startsWith("sk-ant-")) return "已保存。提醒：Anthropic 的密钥通常以 sk-ant- 开头，请确认没有复制错。";
  return `已保存（…${key.slice(-4)}）`;
}

// ---------- 备份 ----------
function backupCard() {
  const { people, gifts, settings } = getState();
  const last = el("p", { class: "muted" }, lastBackupText(settings.lastBackupAt));

  const exportBtn = el("button", { class: "btn btn-primary", type: "button" }, "导出备份");
  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    try {
      const r = await exportBackup();
      showToast(`已导出：${r.people} 位、${r.gifts} 件礼物、${r.photos} 张照片`);
      last.textContent = lastBackupText(getState().settings.lastBackupAt);
    } catch (err) {
      showToast(`导出失败：${err.message}`);
    } finally {
      exportBtn.disabled = false;
    }
  });

  const fileInput = el("input", { type: "file", accept: ".json,application/json", class: "visually-hidden" });
  const importBtn = el("button", { class: "btn", type: "button" }, "导入备份");
  importBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) await importFlow(file);
  });

  return el("section", { class: "card" },
    el("h2", {}, el("span", { class: "deco deco-gift" }), " 备份"),
    el("p", {}, `现在有 ${people.length} 位朋友 / 家人、${gifts.length} 件礼物。`),
    last,
    el("p", { class: "muted" }, "导出会把全部数据和照片存成一个 .json 文件。换手机、换浏览器或清除了浏览器数据后，可以用它恢复。"),
    el("div", { class: "card-actions" }, exportBtn, importBtn, fileInput),
  );
}

async function importFlow(file) {
  let parsed;
  try {
    parsed = await readBackupFile(file);
  } catch (err) {
    // 文件有问题：提示，不动现有数据
    await confirmDialog({ title: "无法导入", message: err.message, confirmText: "知道了", cancelText: "关闭" });
    return;
  }

  const { summary, exportedAt } = parsed;
  const current = getState();
  const when = exportedAt ? `（导出于 ${formatDateTime(exportedAt)}）` : "";
  const lines = [
    `备份里有 ${summary.people} 位朋友 / 家人、${summary.gifts} 件礼物、${summary.photos} 张照片${when}。`,
    summary.missingPhotos ? `其中 ${summary.missingPhotos} 张照片缺失，对应的礼物会保留但没有照片。` : "",
    `导入会替换这台设备上现有的 ${current.people.length} 位、${current.gifts.length} 件礼物，无法撤销。`,
    "如果现在的数据也想保留，请先取消，点\"导出备份\"存一份。",
  ].filter(Boolean);

  const ok = await confirmDialog({ title: "确定导入这份备份？", message: lines.join("\n"), confirmText: "导入并替换", danger: true });
  if (!ok) return;

  try {
    await importBackup(parsed);
    showToast(`导入完成：${summary.people} 位、${summary.gifts} 件礼物`);
    location.hash = "#/home";
  } catch (err) {
    showToast(`导入失败，现有数据没有改动：${err.message}`);
  }
}

function lastBackupText(iso) {
  if (!iso) return "还没有导出过备份。";
  const days = diffDays(toYMD(new Date(iso)), toYMD());
  const ago = days <= 0 ? "今天" : `${days} 天前`;
  const warn = days >= 30 ? "，建议再导出一次" : "";
  return `上次备份：${formatDateTime(iso)}（${ago}${warn}）`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未知时间";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- 数据安全 ----------
function safetyCard() {
  const mode = el("p", { class: "muted" },
    `打开方式：${isStandalone() ? "主屏幕 App（独立窗口）" : "浏览器"}`);
  const persist = el("p", { class: "muted" }, "正在检查…");
  const usage = el("p", { class: "muted" });

  // 是否长期保存由浏览器自己决定（启动时已申请过），这里只用大白话说明结果
  checkPersisted().then((ok) => {
    persist.textContent = ok === true
      ? "这台设备会长期保存这里的数据。偶尔导出一份备份，换手机时也能用。"
      : "这台设备无法保证长期保存这里的数据，建议定期导出备份。";
  });
  estimateUsage().then((r) => {
    if (r?.usage == null) return;
    const mb = r.usage / 1024 / 1024;
    usage.textContent = mb < 0.1 ? "已使用不到 0.1 MB 存储空间。" : `已使用约 ${mb.toFixed(1)} MB 存储空间。`;
  });

  return el("section", { class: "card" },
    el("h2", {}, el("span", { class: "deco deco-heart" }), " 数据安全"),
    el("ul", { class: "tips" },
      el("li", {}, "所有数据只保存在这台设备的这个浏览器里，不会上传，换设备不会自动同步。"),
      el("li", {}, el("strong", {}, "清除浏览器数据（历史记录、网站数据）会删除这里的全部记录。")),
      el("li", {}, "iPhone：Safari 可能会清除长期没打开的网站数据。建议用\"添加到主屏幕\"，以后从主屏幕图标打开。"),
      el("li", {}, "注意：从主屏幕图标打开的 tamago 和 Safari 里的数据是分开的。第一次从主屏幕打开前，请先在 Safari 里导出备份，再在主屏幕版里导入。"),
      el("li", {}, "请定期导出备份，比如每次登记完礼物后。"),
    ),
    mode,
    persist,
    usage,
  );
}

// ---------- 版本号（确认手机拿到的是最新版本）+ 安全区域高度 ----------
function versionLine() {
  const line = el("p", { class: "muted small-print version-line" }, `tamago v${APP_VERSION}`);
  // 读出 CSS 里 iPhone 安全区域的实际高度（普通浏览器里都是 0）
  requestAnimationFrame(() => {
    const probe = el("div", { style: { position: "fixed", visibility: "hidden", paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" } });
    document.body.append(probe);
    const s = getComputedStyle(probe);
    const top = Math.round(parseFloat(s.paddingTop));
    const bottom = Math.round(parseFloat(s.paddingBottom));
    probe.remove();
    if (top || bottom) line.textContent += ` · 安全区域 上 ${top}px / 下 ${bottom}px`;
  });
  return line;
}

// ---------- 示例数据 ----------
function sampleCard() {
  const btn = el("button", { class: "btn btn-danger", type: "button" }, "清除示例数据");
  btn.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "清除示例数据？",
      message: "会删除载入的示例朋友（以及你给他们添加的礼物），你自己登记的数据不受影响。",
      confirmText: "清除",
      danger: true,
    });
    if (!ok) return;
    try {
      await clearSampleData();
      showToast("示例数据已清除");
      refresh();
    } catch (err) {
      showToast(err.message);
    }
  });

  return el("section", { class: "card" },
    el("h2", {}, el("span", { class: "deco deco-sparkle" }), " 示例数据"),
    el("p", { class: "muted" }, "现在还有载入的示例数据。体验完可以一键清除。"),
    el("div", { class: "card-actions" }, btn),
  );
}
