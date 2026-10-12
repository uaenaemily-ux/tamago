// 导出 / 导入备份。
//
// 备份文件格式（JSON）：
// {
//   app: "tamago",
//   backupVersion: 1,           // 备份文件格式的版本
//   schemaVersion: 1,           // 里面数据的版本（见 schema.js）
//   exportedAt: "2026-10-11T08:00:00.000Z",
//   data: { ...主数据，settings 里不含 apiKey },
//   photos: { "ph_xxx": "data:image/jpeg;base64,..." }
// }
//
// 导入时先完整检查，任何一处不对就整份拒绝，不碰现有数据。
import { getState, getPhotosByIds, replaceAllData, updateSettings, cleanAnniversaries } from "./store.js";
import { migrate, CATEGORIES, CURRENT_VERSION } from "./schema.js";
import { isPhotoDataUrl } from "./photos.js";
import { todayISO } from "./dates.js";

export const BACKUP_VERSION = 1;
const MAX_FILE_MB = 60;

// ---------- 导出 ----------

export async function createBackup() {
  const state = getState();
  const { apiKey, ...settings } = state.settings; // 密钥不放进备份
  const photoIds = state.gifts.map((g) => g.photoId).filter(Boolean);
  return {
    app: "tamago",
    backupVersion: BACKUP_VERSION,
    schemaVersion: state.schemaVersion,
    exportedAt: new Date().toISOString(),
    data: { ...state, settings },
    photos: await getPhotosByIds(photoIds),
  };
}

export function backupFileName(date = new Date()) {
  return `tamago-backup-${todayISO(date)}.json`;
}

// 生成备份文件并下载，成功后记录"上次备份时间"
export async function exportBackup() {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await updateSettings({ lastBackupAt: backup.exportedAt });
  return { people: backup.data.people.length, gifts: backup.data.gifts.length, photos: Object.keys(backup.photos).length };
}

// ---------- 导入 ----------

const BAD_FILE = "文件无法识别：这不是有效的 tamago 备份文件";

// 读取用户选的文件，检查后返回 { data, photos, summary }；有问题时抛出中文错误
export async function readBackupFile(file) {
  if (!file) throw new Error("没有选择文件");
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`文件太大了（超过 ${MAX_FILE_MB} MB），不像是 tamago 的备份`);
  return parseBackup(await file.text());
}

// 检查备份内容（纯函数，方便测试）
export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error(BAD_FILE);
  }
  if (!backup || typeof backup !== "object" || backup.app !== "tamago") throw new Error(BAD_FILE);
  if (!Number.isInteger(backup.backupVersion) || backup.backupVersion < 1) throw new Error(BAD_FILE);
  if (backup.backupVersion > BACKUP_VERSION) {
    throw new Error("这份备份来自更新版本的 tamago，请先更新网页再导入");
  }
  if (!backup.data || typeof backup.data !== "object") throw new Error(BAD_FILE);

  let data;
  try {
    data = migrate({ ...backup.data, schemaVersion: backup.data.schemaVersion ?? backup.schemaVersion });
  } catch (err) {
    throw new Error(`文件无法识别：${err.message}`);
  }

  const photos = cleanPhotos(backup.photos);
  const result = validateData(data, photos);
  return { ...result, exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : null };
}

function cleanPhotos(photos) {
  const clean = {};
  if (photos && typeof photos === "object") {
    for (const [id, value] of Object.entries(photos)) {
      if (typeof id === "string" && isPhotoDataUrl(value)) clean[id] = value;
    }
  }
  return clean;
}

const isText = (v) => typeof v === "string";
const isOptionalText = (v) => v == null || typeof v === "string";

// 逐条检查人、礼物、偏好；只保留已知字段。格式不对就整份拒绝
function validateData(data, photos) {
  const fail = (what) => {
    throw new Error(`文件内容不完整或已损坏（${what}），没有导入`);
  };

  const personIds = new Set();
  const people = data.people.map((p, i) => {
    const b = p?.birthday;
    if (!p || !isText(p.id) || !p.id || personIds.has(p.id)) fail(`第 ${i + 1} 个人的编号`);
    if (!isText(p.name) || !p.name.trim()) fail(`第 ${i + 1} 个人的名字`);
    if (!CATEGORIES.includes(p.category)) fail(`第 ${i + 1} 个人的分类`);
    if (!b || !Number.isInteger(b.month) || b.month < 1 || b.month > 12
      || !Number.isInteger(b.day) || b.day < 1 || b.day > 31
      || !(b.year == null || Number.isInteger(b.year))) fail(`${p.name} 的生日`);
    if (p.tags != null && (!Array.isArray(p.tags) || !p.tags.every(isText))) fail(`${p.name} 的标签`);
    let anniversaries;
    try {
      anniversaries = cleanAnniversaries(p.anniversaries);
    } catch {
      fail(`${p.name} 的纪念日`);
    }
    personIds.add(p.id);
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      birthday: { year: b.year ?? null, month: b.month, day: b.day },
      eggColor: isText(p.eggColor) ? p.eggColor : null,
      tags: p.tags || [],
      personalColors: Array.isArray(p.personalColors) ? p.personalColors.filter(isText) : [],
      anniversaries,
      ...(p.sample ? { sample: true } : {}),
      createdAt: isText(p.createdAt) ? p.createdAt : new Date().toISOString(),
      updatedAt: isText(p.updatedAt) ? p.updatedAt : new Date().toISOString(),
    };
  });

  let missingPhotos = 0;
  const giftIds = new Set();
  const gifts = data.gifts.map((g, i) => {
    if (!g || !isText(g.id) || !g.id || giftIds.has(g.id)) fail(`第 ${i + 1} 件礼物的编号`);
    if (!personIds.has(g.personId)) fail(`第 ${i + 1} 件礼物找不到对应的人`);
    if (!isText(g.name) || !g.name.trim()) fail(`第 ${i + 1} 件礼物的名称`);
    for (const key of ["category", "date", "occasion", "reaction", "photoId"]) {
      if (!isOptionalText(g[key])) fail(`礼物「${g.name}」的${key}`);
    }
    giftIds.add(g.id);
    // 照片不在备份里（或不是图片）：礼物保留，照片去掉
    let photoId = g.photoId || null;
    if (photoId && !photos[photoId]) {
      photoId = null;
      missingPhotos++;
    }
    return {
      id: g.id,
      personId: g.personId,
      name: g.name,
      category: g.category || "",
      date: g.date || "",
      occasion: g.occasion || "",
      reaction: g.reaction || "",
      photoId,
      source: g.source === "ai" ? "ai" : "manual",
      ...(g.sample ? { sample: true } : {}),
      createdAt: isText(g.createdAt) ? g.createdAt : new Date().toISOString(),
    };
  });

  // 偏好记录（"更喜欢" / "不喜欢" 两种）：格式不对或找不到对应的人就跳过（不影响导入）
  const isObj = (v) => v && typeof v === "object";
  const preferences = data.preferences
    .filter((p) => p && isText(p.id) && personIds.has(p.personId))
    .map((p) => {
      const base = { id: p.id, personId: p.personId, createdAt: isText(p.createdAt) ? p.createdAt : null };
      if (p.type === "dislike") return isObj(p.plan) ? { ...base, type: "dislike", plan: p.plan } : null;
      return isObj(p.chosen) ? { ...base, type: "prefer", chosen: p.chosen, rejected: isObj(p.rejected) ? p.rejected : null } : null;
    })
    .filter(Boolean);

  // 设置只取已知字段；apiKey 一律不从备份里取
  const s = data.settings;
  const settings = {
    onboarded: true,
    lastBackupAt: isText(s.lastBackupAt) ? s.lastBackupAt : null,
    rangeDays: Number.isInteger(s.rangeDays) && s.rangeDays > 0 && s.rangeDays <= 366 ? s.rangeDays : 30,
    model: isText(s.model) && s.model.trim() ? s.model : undefined,
  };

  // 只保留被礼物用到的照片
  const usedPhotos = {};
  for (const g of gifts) if (g.photoId) usedPhotos[g.photoId] = photos[g.photoId];

  return {
    data: { schemaVersion: CURRENT_VERSION, settings, people, gifts, preferences },
    photos: usedPhotos,
    summary: {
      people: people.length,
      gifts: gifts.length,
      photos: Object.keys(usedPhotos).length,
      missingPhotos,
    },
  };
}

// 用检查过的备份替换现有全部数据（保留本机的 API 密钥）
export async function importBackup({ data, photos }) {
  await replaceAllData(data, photos);
}
