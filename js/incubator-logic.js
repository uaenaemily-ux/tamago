// 灵感孵化的业务逻辑：整理发给 AI 的信息、规定回答格式、检查回答、找出同品类的旧礼物。
// 真正发请求在 ai.js 的 callAI()。
import { callAI, AIError } from "./ai.js";
import { getAge, getZodiac, nextBirthday } from "./dates.js";
import { GIFT_CATEGORIES } from "./schema.js";

// 预算档位（人民币）
export const BUDGETS = [
  { id: "lt200", label: "200 以下", text: "200 元以下" },
  { id: "200-500", label: "200–500", text: "200 到 500 元" },
  { id: "500-1000", label: "500–1000", text: "500 到 1000 元" },
  { id: "gt1000", label: "1000 以上", text: "1000 元以上" },
];

export function findBudget(id) {
  return BUDGETS.find((b) => b.id === id) || null;
}

// 要求 AI 严格按这个格式回答（结构化输出）
export const PLANS_SCHEMA = {
  type: "object",
  properties: {
    plans: {
      type: "array",
      description: "恰好两个方案：第一个 label 为 A，第二个为 B",
      items: {
        type: "object",
        properties: {
          label: { type: "string", enum: ["A", "B"] },
          name: { type: "string", description: "具体的礼物，比如「复古胶片相机挂绳 + 一卷彩色胶卷」" },
          category: { type: "string", description: "品类，尽量用礼物墙或常用品类里的词" },
          priceRange: { type: "string", description: "大致价位，如「约 300 元」或「250–350 元」" },
          style: { type: "string", description: "方向，2–6 个字，如「实用」「纪念意义」「体验」" },
          reason: { type: "string", description: "推荐理由，2–3 句，引用具体的喜好标签" },
          matchedTags: { type: "array", items: { type: "string" }, description: "理由里用到的喜好标签，原样照抄" },
          sameCategoryGiftIds: {
            type: "array", items: { type: "string" },
            description: "礼物墙里和这个方案同品类的礼物编号；没有就是空数组",
          },
        },
        required: ["label", "name", "category", "priceRange", "style", "reason", "matchedTags", "sameCategoryGiftIds"],
        additionalProperties: false,
      },
    },
  },
  required: ["plans"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `你是「tamago」的送礼灵感助手。用户会告诉你一位朋友或家人的信息、喜好标签和过去的送礼记录，你要给出两个有个人特色的礼物方案。

要求：
- 两个方案方向要明显不同，比如一个实用、一个有纪念意义，或一个是物品、一个是体验。
- 价位必须在用户选的预算区间内，用人民币。
- 礼物要具体、在国内能买到：写清楚是什么东西、有什么特点。可以提常见品牌，但不要编造具体型号、价格精确到个位或购买链接。
- 推荐理由 2–3 句，口语、温暖，必须引用 TA 具体的喜好标签（matchedTags 里原样列出用到的标签）。没有标签时，根据年龄、星座、关系和场合推荐，matchedTags 留空。
- 不要推荐和送礼记录里相同的礼物。如果对方对某类礼物反应不好，避开那一类。
- 品类（category）优先用送礼记录里出现过的品类词；没有合适的，就从这些常用品类里选：${GIFT_CATEGORIES.join("、")}。
- 如果某个方案和送礼记录里的礼物属于同一品类，把那些礼物的编号（方括号里的 id）填进 sameCategoryGiftIds；否则留空。
- 全部用简体中文。`;

// 整理发给 AI 的文字（只发文字，不发照片）
// hints：用户额外给的提示词；avoid：这次已经推荐过的方案；disliked：用户明确不喜欢的方案
export function buildPrompt({ person, gifts, budget, occasion, hints = [], avoid = [], disliked = [], today = new Date() }) {
  const age = getAge(person.birthday, today);
  const next = nextBirthday(person.birthday, today);
  const lines = [
    "## 关于 TA",
    `- 关系：${person.category === "family" ? "家人" : "朋友"}`,
    `- 年龄：${age != null ? `${age} 岁` : "不详"}`,
    `- 星座：${getZodiac(person.birthday)}`,
    `- 离下一次生日：${next.daysUntil === 0 ? "就是今天" : `${next.daysUntil} 天`}`,
    "",
    "## 喜好标签",
    person.tags.length ? person.tags.map((t) => `- ${t}`).join("\n") : "（还没有标签）",
    "",
    "## 送礼记录（从新到旧）",
    gifts.length
      ? gifts.map((g) => `- [${g.id}] ${g.name}｜品类：${g.category || "未填"}｜${g.date || "日期未填"}｜场合：${g.occasion || "未填"}｜对方反应：${g.reaction || "未填"}`).join("\n")
      : "（还没有送礼记录）",
    "",
    "## 这次",
    `- 预算：${budget.text}`,
    `- 场合：${occasion}`,
  ];
  if (hints.length) {
    lines.push("", "## 用户额外给的提示词（请以这些为重点来构思）", ...hints.map((h) => `- ${h}`));
  }
  if (disliked.length) {
    lines.push("", "## 用户不喜欢这些方案（避开类似的方向和品类）", ...disliked.map((p) => `- ${p.name}（${p.category}，${p.style}）`));
  }
  const notDisliked = avoid.filter((a) => !disliked.some((d) => d.name === a.name));
  if (notDisliked.length) {
    lines.push("", "## 这次已经推荐过（不要重复，给出新的想法）", ...notDisliked.map((p) => `- ${p.name}`));
  }
  lines.push("", "请给出 Plan A 和 Plan B。");
  return { system: SYSTEM_PROMPT, prompt: lines.join("\n") };
}

// 统一品类写法再比较（去空格、忽略大小写）
const normCategory = (c) => String(c || "").trim().toLowerCase();

/**
 * 检查 AI 的回答，整理成页面要用的方案。格式不对时抛出 AIError("bad_format")。
 * 每个方案附上 sameCategoryGifts（同品类的旧礼物对象）：
 * 以 AI 标出的为准，再用品类文字完全一致的礼物补充（以防 AI 漏标）。
 */
export function parsePlans(text, gifts) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AIError("bad_format", "AI 返回的格式不对");
  }
  const plans = data?.plans;
  if (!Array.isArray(plans) || plans.length !== 2) throw new AIError("bad_format", "AI 返回的方案数量不对");

  const giftById = new Map(gifts.map((g) => [g.id, g]));
  return plans.map((p, i) => {
    for (const key of ["name", "category", "priceRange", "style", "reason"]) {
      if (typeof p?.[key] !== "string" || !p[key].trim()) throw new AIError("bad_format", "AI 返回的方案缺少内容");
    }
    const fromAI = (Array.isArray(p.sameCategoryGiftIds) ? p.sameCategoryGiftIds : [])
      .map((id) => giftById.get(id))
      .filter(Boolean);
    const byText = gifts.filter((g) => g.category && normCategory(g.category) === normCategory(p.category));
    const sameCategoryGifts = [...new Set([...fromAI, ...byText])];
    return {
      label: i === 0 ? "A" : "B",
      name: p.name.trim(),
      category: p.category.trim(),
      priceRange: p.priceRange.trim(),
      style: p.style.trim(),
      reason: p.reason.trim(),
      matchedTags: (Array.isArray(p.matchedTags) ? p.matchedTags : []).filter((t) => typeof t === "string" && t.trim()),
      sameCategoryGifts,
    };
  });
}

/**
 * 孵化：请求 AI 并检查回答。格式不对时自动重试一次。
 * 返回 [planA, planB]
 */
export async function incubate({ person, gifts, budget, occasion, hints, avoid, disliked }) {
  const { system, prompt } = buildPrompt({ person, gifts, budget, occasion, hints, avoid, disliked });
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callAI({ system, prompt, schema: PLANS_SCHEMA, effort: "medium" });
    try {
      return parsePlans(text, gifts);
    } catch (err) {
      lastError = err;
    }
  }
  throw new AIError("bad_format", `${lastError.message}，重试后仍然不对，请重新孵化`);
}

// 记录"我更喜欢这个！"时保存的方案摘要
export function planSummary(plan) {
  const { name, category, priceRange, style, reason } = plan;
  return { name, category, priceRange, style, reason };
}

// 提示词：用逗号、顿号、空格分开，去空、去重，最多 8 个
export function parseHints(text) {
  const seen = new Set();
  return String(text || "")
    .split(/[,，、;；\s]+/)
    .map((h) => h.trim().slice(0, 20))
    .filter((h) => h && !seen.has(h) && seen.add(h))
    .slice(0, 8);
}

// ---------- 展开灵感清单 ----------

export const IDEAS_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      description: "3 到 5 个更具体的礼物方向",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "具体的礼物方向，如「芭蕾舞鞋造型珍珠发夹」" },
          note: { type: "string", description: "一句话说明为什么适合 TA" },
          keywords: {
            type: "array", items: { type: "string" },
            description: "1–2 个适合在购物平台搜索的关键词，只写词语，不要网址",
          },
        },
        required: ["title", "note", "keywords"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

const IDEAS_SYSTEM = `你是「tamago」的送礼灵感助手。用户已经选定了一个喜欢的礼物方案，请在这个方案的方向上，展开 3–5 个更具体、可以直接去买的礼物方向。

要求：
- 每个方向写清楚是什么东西（材质、款式、特点），不要和别的方向重复。
- 每个方向附 1–2 个搜索关键词：适合直接粘贴到淘宝、小红书这类购物平台搜索，简短（2–8 个字或几个英文单词），不要带价格。第一个用中文；如果合适，第二个可以用英文，方便在海外网站搜索。
- 不要输出任何网址、链接、店铺名或商品编号，只写词语。
- 价位保持在用户的预算区间内。
- 全部用简体中文（英文关键词除外）。`;

export function buildIdeasPrompt({ person, plan, budget, occasion }) {
  const lines = [
    `TA 是我的${person.category === "family" ? "家人" : "朋友"}，喜好标签：${person.tags.length ? person.tags.join("、") : "（没有）"}。`,
    `场合：${occasion}；预算：${budget.text}。`,
    "",
    "我选定的方案：",
    `- 礼物：${plan.name}`,
    `- 品类：${plan.category}`,
    `- 方向：${plan.style}`,
    `- 理由：${plan.reason}`,
    "",
    "请展开 3–5 个更具体的礼物方向，每个附 1–2 个搜索关键词。",
  ];
  return { system: IDEAS_SYSTEM, prompt: lines.join("\n") };
}

// 关键词里不允许出现网址：像网址的直接丢掉
const looksLikeUrl = (k) => /https?:|www\.|:\/\/|\.(com|cn|net|org)\b|\//i.test(k);

export function cleanKeyword(k) {
  if (typeof k !== "string") return null;
  const t = k.trim().replace(/\s+/g, " ");
  if (!t || t.length > 30 || looksLikeUrl(t)) return null;
  return t;
}

// 检查灵感清单：3–5 个方向（多的截掉），每个 1–2 个关键词（多的截掉，像网址的丢掉）
export function parseIdeas(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AIError("bad_format", "AI 返回的格式不对");
  }
  if (!Array.isArray(data?.ideas)) throw new AIError("bad_format", "AI 返回的格式不对");
  const ideas = data.ideas
    .map((idea) => {
      if (typeof idea?.title !== "string" || !idea.title.trim()) return null;
      const keywords = [...new Set((Array.isArray(idea.keywords) ? idea.keywords : []).map(cleanKeyword).filter(Boolean))].slice(0, 2);
      if (!keywords.length) return null;
      return { title: idea.title.trim(), note: typeof idea.note === "string" ? idea.note.trim() : "", keywords };
    })
    .filter(Boolean)
    .slice(0, 5);
  if (ideas.length < 3) throw new AIError("bad_format", "AI 返回的方向太少");
  return ideas;
}

// 展开灵感清单：格式不对时自动重试一次
export async function expandIdeas({ person, plan, budget, occasion }) {
  const { system, prompt } = buildIdeasPrompt({ person, plan, budget, occasion });
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callAI({ system, prompt, schema: IDEAS_SCHEMA, effort: "low" });
    try {
      return parseIdeas(text);
    } catch (err) {
      lastError = err;
    }
  }
  throw new AIError("bad_format", `${lastError.message}，重试后仍然不对，请再试一次`);
}
