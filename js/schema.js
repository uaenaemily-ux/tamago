// 数据格式、版本号和迁移。
// 修改数据结构时：CURRENT_VERSION +1，并在 migrations 里加一个迁移函数；不改旧字段的含义。

export const CURRENT_VERSION = 1;

export const DEFAULT_MODEL = "claude-sonnet-5-5";

// 守护蛋的预设颜色（pastel）
export const EGG_COLORS = [
  "#F7B8CB", // 粉
  "#C9E6F7", // baby blue
  "#FFE9A8", // 奶黄
  "#BFEBDD", // 薄荷
  "#DCCCF5", // 薰衣草
  "#FFD3BA", // 蜜桃
];

export const CATEGORIES = ["friend", "family"];

export function createDefaultSettings() {
  return {
    onboarded: false,       // 是否看过欢迎页
    lastBackupAt: null,     // 上次导出备份的时间
    rangeDays: 30,          // 首页显示多少天内的生日
    apiKey: "",             // 只存本地，导出备份时不包含
    model: DEFAULT_MODEL,
  };
}

export function createDefaultData() {
  return {
    schemaVersion: CURRENT_VERSION,
    settings: createDefaultSettings(),
    people: [],
    gifts: [],
    preferences: [],
  };
}

// 旧版本 → 新版本的迁移函数。键是"升级后的版本号"。
// 例：2: (data) => { data.people.forEach((p) => { p.metDate = null; }); return data; },
const migrations = {};

// 把任意版本的数据升级到当前版本。数据无法识别时抛出错误（调用方不能覆盖现有数据）。
export function migrate(input) {
  if (!input || typeof input !== "object") {
    throw new Error("数据格式无法识别");
  }

  const version = input.schemaVersion;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("数据缺少有效的版本号");
  }
  if (version > CURRENT_VERSION) {
    throw new Error("这份数据来自更新版本的 tamago，请先更新网页");
  }

  let data = structuredClone(input);
  for (let v = version + 1; v <= CURRENT_VERSION; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`缺少升级到版本 ${v} 的迁移函数`);
    data = step(data);
    data.schemaVersion = v;
  }

  return normalize(data);
}

// 补齐缺失的字段，保证后面的代码可以放心使用
function normalize(data) {
  for (const key of ["people", "gifts", "preferences"]) {
    if (data[key] == null) data[key] = [];
    if (!Array.isArray(data[key])) throw new Error(`数据中的 ${key} 格式不对`);
  }
  data.settings = { ...createDefaultSettings(), ...(data.settings || {}) };
  return data;
}
