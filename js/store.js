// 数据读写的唯一入口。页面不要直接碰 IndexedDB。
//
// 存储位置（浏览器 IndexedDB，数据库 "tamago"）：
//   tamago:data   主数据（见 schema.js）
//   photo:<id>    压缩后的照片 dataURL
//
// 写入方式：先生成新数据 → 存进 IndexedDB → 成功后才替换内存里的数据。
// 这样存储失败（比如空间满了）时，页面上的数据不会和本地存的不一致。

import { createStore, get, set, del, delMany } from "./vendor/idb-keyval.js";
import { createDefaultData, migrate, CATEGORIES, EGG_COLORS, GIFT_CATEGORIES, OCCASIONS } from "./schema.js";
import { validateBirthday, parseISODate } from "./dates.js";

const DATA_KEY = "tamago:data";
const PHOTO_PREFIX = "photo:";

let db = createStore("tamago", "kv");
let state = null;

// 存储空间满等错误，统一转成这个，页面显示 message 即可
export class StorageError extends Error {}

// ---------- 启动 ----------

// 读取本地数据；没有就用默认数据。必须在使用其他函数之前调用一次。
export async function loadState() {
  const raw = await get(DATA_KEY, db);
  if (!raw) {
    state = createDefaultData();
    return state;
  }
  const data = migrate(raw);
  if (data.schemaVersion !== raw.schemaVersion) {
    await set(DATA_KEY, data, db); // 升级后的数据马上存回去
  }
  state = data;
  return state;
}

export function getState() {
  if (!state) throw new Error("数据还没加载，请先调用 loadState()");
  return state;
}

async function commit(next) {
  try {
    await set(DATA_KEY, next, db);
  } catch (err) {
    throw toStorageError(err);
  }
  state = next;
  return state;
}

function toStorageError(err) {
  if (err && err.name === "QuotaExceededError") {
    return new StorageError("存储空间满了，请先到设置页导出备份，再删除一些照片");
  }
  return new StorageError("保存失败，请稍后再试");
}

// 生成不重复的 id，如 "p_lq3x9a_k2f8"（不依赖 crypto.randomUUID，局域网 http 下也能用）
export function newId(prefix) {
  const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

const now = () => new Date().toISOString();

// ---------- 持久存储 ----------

// 申请持久存储，降低浏览器自动清除数据的可能。
// 返回 "granted" | "denied" | "unsupported"，设置页会显示结果。
let persistStatus = "unknown";

export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) {
      persistStatus = "unsupported";
    } else if (await navigator.storage.persisted()) {
      persistStatus = "granted";
    } else {
      persistStatus = (await navigator.storage.persist()) ? "granted" : "denied";
    }
  } catch {
    persistStatus = "unsupported";
  }
  return persistStatus;
}

export function getPersistStatus() {
  return persistStatus;
}

// ---------- 设置 ----------

export function updateSettings(patch) {
  return commit({ ...state, settings: { ...state.settings, ...patch } });
}

// ---------- 朋友 / 家人 ----------

export function getPerson(id) {
  return state.people.find((p) => p.id === id) || null;
}

export function listPeople(category) {
  return category ? state.people.filter((p) => p.category === category) : state.people;
}

// 检查并整理朋友信息；不合法时抛出中文错误
function cleanPerson(fields) {
  const name = String(fields.name ?? "").trim();
  if (!name) throw new Error("请填写名字");
  if (name.length > 30) throw new Error("名字太长了");
  if (!CATEGORIES.includes(fields.category)) throw new Error("请选择朋友或家人");

  const birthday = {
    year: fields.birthday?.year ?? null,
    month: fields.birthday?.month,
    day: fields.birthday?.day,
  };
  const error = validateBirthday(birthday);
  if (error) throw new Error(error);

  return {
    name,
    category: fields.category,
    birthday,
    eggColor: fields.eggColor || EGG_COLORS[state.people.length % EGG_COLORS.length],
    tags: cleanTags(fields.tags),
    personalColors: Array.isArray(fields.personalColors) ? fields.personalColors : [],
  };
}

// 标签：去空格、去空、去重
export function cleanTags(tags) {
  const seen = new Set();
  const result = [];
  for (const tag of tags || []) {
    const t = String(tag).trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  return result;
}

export async function addPerson(fields) {
  const person = { id: newId("p"), ...cleanPerson(fields), createdAt: now(), updatedAt: now() };
  await commit({ ...state, people: [...state.people, person] });
  return person;
}

export async function updatePerson(id, fields) {
  const old = getPerson(id);
  if (!old) throw new Error("找不到这个人");
  const person = { ...old, ...cleanPerson({ ...old, ...fields }), updatedAt: now() };
  await commit({ ...state, people: state.people.map((p) => (p.id === id ? person : p)) });
  return person;
}

// 删除一个人，连同 TA 的礼物、照片和偏好记录
export async function deletePerson(id) {
  const gifts = state.gifts.filter((g) => g.personId === id);
  const photoIds = gifts.map((g) => g.photoId).filter(Boolean);

  await commit({
    ...state,
    people: state.people.filter((p) => p.id !== id),
    gifts: state.gifts.filter((g) => g.personId !== id),
    preferences: state.preferences.filter((p) => p.personId !== id),
  });
  // 照片最后删：即使这里失败，也只是留下用不到的照片，不影响主数据
  if (photoIds.length) await delMany(photoIds.map(photoKey), db).catch(() => {});
}

// ---------- 礼物 ----------

export function getGift(id) {
  return state.gifts.find((g) => g.id === id) || null;
}

// 某人的礼物，按日期从新到旧
export function listGifts(personId) {
  return state.gifts
    .filter((g) => g.personId === personId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// 输入建议：预设 + 已经用过的（去重），用过的排前面
export function suggestGiftCategories() {
  return unique([...state.gifts.map((g) => g.category), ...GIFT_CATEGORIES]);
}
export function suggestOccasions() {
  return unique([...state.gifts.map((g) => g.occasion), ...OCCASIONS]);
}
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanGift(fields) {
  const name = String(fields.name ?? "").trim();
  if (!name) throw new Error("请填写礼物名称");
  if (!getPerson(fields.personId)) throw new Error("找不到这个人");

  const date = fields.date || "";
  if (date && !parseISODate(date)) throw new Error("日期格式不对");

  return {
    personId: fields.personId,
    name,
    category: String(fields.category ?? "").trim(),
    date,
    occasion: String(fields.occasion ?? "").trim(),
    reaction: String(fields.reaction ?? "").trim(),
    photoId: fields.photoId || null,
    source: fields.source === "ai" ? "ai" : "manual",
  };
}

export async function addGift(fields) {
  const gift = { id: newId("g"), ...cleanGift(fields), createdAt: now() };
  await commit({ ...state, gifts: [...state.gifts, gift] });
  return gift;
}

export async function updateGift(id, fields) {
  const old = getGift(id);
  if (!old) throw new Error("找不到这件礼物");
  const gift = { ...old, ...cleanGift({ ...old, ...fields }) };
  await commit({ ...state, gifts: state.gifts.map((g) => (g.id === id ? gift : g)) });
  // 换了照片：删掉旧照片
  if (old.photoId && old.photoId !== gift.photoId) await deletePhoto(old.photoId).catch(() => {});
  return gift;
}

export async function deleteGift(id) {
  const old = getGift(id);
  if (!old) return;
  await commit({ ...state, gifts: state.gifts.filter((g) => g.id !== id) });
  if (old.photoId) await deletePhoto(old.photoId).catch(() => {});
}

// ---------- 偏好记录（"我更喜欢这个！"） ----------

export async function addPreference({ personId, chosen, rejected }) {
  const pref = { id: newId("pref"), personId, chosen, rejected, createdAt: now() };
  await commit({ ...state, preferences: [...state.preferences, pref] });
  return pref;
}

// ---------- 照片 ----------

const photoKey = (id) => PHOTO_PREFIX + id;

// 保存一张已压缩的照片（dataURL），返回照片 id
export async function savePhoto(dataUrl) {
  const id = newId("ph");
  try {
    await set(photoKey(id), dataUrl, db);
  } catch (err) {
    throw toStorageError(err);
  }
  return id;
}

export async function getPhoto(id) {
  return id ? (await get(photoKey(id), db)) ?? null : null;
}

export async function deletePhoto(id) {
  await del(photoKey(id), db);
}

// ---------- 测试用 ----------

// 切换到另一个数据库（测试页用，避免碰到真实数据）
export function useDatabaseForTesting(dbName) {
  db = createStore(dbName, "kv");
  state = null;
}
