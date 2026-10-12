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

// 朋友 / 家人的纪念日 person.anniversaries（可选，没有就是 []）：
//   [{ id, name: "相识纪念日", month, day, year: 2018 | null }]

// 偏好记录 preferences 的格式（type 可选，旧数据没有 type 时当作 prefer）：
//   { id, personId, type: "prefer",  chosen, rejected, createdAt }  "我更喜欢这个！"
//   { id, personId, type: "dislike", plan, createdAt }               "不喜欢"

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

// 礼物品类和场合的输入建议（也可以自己填别的）。
// 品类尽量统一用词，AI 判断"同品类"时更准。
export const GIFT_CATEGORIES = [
  "饰品", "服饰", "包包", "美妆护肤", "香水", "玩偶", "书籍", "文具",
  "数码", "家居", "食品", "鲜花", "体验", "手作",
];
export const OCCASIONS = ["生日", "圣诞节", "新年", "情人节", "纪念日", "毕业", "日常惊喜"];
