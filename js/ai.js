// 全项目唯一发起 AI 请求的地方（见 CLAUDE.md「AI」）。
// 用用户在设置页填的 Anthropic API 密钥，从浏览器直接请求 Claude Messages API。
// 只负责"发请求、拿回文字、把错误翻译成中文"，不关心业务。
//
// 为什么用 fetch 而不是官方 SDK：本项目约定不用 npm、不用构建工具，所有 AI 调用集中在这一个函数里。
import { getState } from "./store.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// 支持服务端自动备用模型（fallbacks: "default"）的模型：被安全策略拒绝时，API 会自动换模型重试
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// 支持 output_config.effort 的模型（其他模型不发这个参数，免得请求被拒）
const EFFORT_MODELS = /^claude-(fable|mythos|opus|sonnet|haiku)-5|^claude-(opus|sonnet)-4-[6-9]/;

// AI 出错时抛出这个，message 是给用户看的中文提示，code 方便页面判断
export class AIError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * 请求 Claude，返回回答的文字。
 * @param {object} options
 * @param {string} options.system     系统提示词
 * @param {string} options.prompt     用户消息
 * @param {object} [options.schema]   JSON Schema：传了就用结构化输出，回答保证是符合它的 JSON 文字
 * @param {string} [options.effort]   思考力度 low / medium / high
 * @param {number} [options.maxTokens]
 * @param {number} [options.timeoutMs]
 */
export async function callAI({ system, prompt, schema, effort = "medium", maxTokens = 16000, timeoutMs = 90000 }) {
  const { apiKey, model } = getState().settings;
  if (!apiKey) throw new AIError("no_key", "还没有填写 API 密钥，请先到设置页填写");

  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  };
  const outputConfig = {};
  if (EFFORT_MODELS.test(model)) outputConfig.effort = effort;
  if (schema) outputConfig.format = { type: "json_schema", schema };
  if (Object.keys(outputConfig).length) body.output_config = outputConfig;

  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": API_VERSION,
    // 允许从浏览器直接调用（密钥只在用户自己的设备上）
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (FALLBACK_MODELS.has(model)) {
    body.fallbacks = "default";
    headers["anthropic-beta"] = FALLBACK_BETA;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw new AIError("timeout", "等了太久没有回应，请稍后再试");
    throw new AIError("network", "连不上 AI 服务，请检查网络后再试");
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // 有些错误返回的不是 JSON，下面按状态码处理
  }

  if (!response.ok) throw httpError(response.status, data);

  // 被安全策略拒绝（HTTP 200，但 stop_reason 是 refusal）
  if (data?.stop_reason === "refusal") {
    throw new AIError("refusal", "AI 这次没有给出建议，换个说法或修改一下标签再试试");
  }
  if (data?.stop_reason === "max_tokens") {
    throw new AIError("max_tokens", "AI 的回答太长被截断了，请重新孵化");
  }

  // 按类型取文字块（前面可能有 thinking 块）
  const text = (data?.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) throw new AIError("empty", "AI 没有返回内容，请重新孵化");
  return text;
}

// 把 HTTP 错误翻译成中文提示
function httpError(status, data) {
  const apiMessage = data?.error?.message || "";
  switch (status) {
    case 401:
      return new AIError("auth", "API 密钥不对或已失效，请到设置页检查");
    case 403:
      return new AIError("permission", "这个密钥没有使用该模型的权限，请到设置页检查密钥或模型名");
    case 404:
      return new AIError("not_found", "找不到这个模型，请到设置页检查模型名");
    case 400:
      if (/credit balance/i.test(apiMessage)) {
        return new AIError("billing", "Anthropic 账户余额不足，请到 Anthropic 控制台充值");
      }
      return new AIError("bad_request", `请求被拒绝：${apiMessage || "参数不对"}`);
    case 402:
      return new AIError("billing", "Anthropic 账户余额或额度不足，请到 Anthropic 控制台查看");
    case 413:
      return new AIError("too_large", "发送的信息太多了，请删减一些送礼记录或标签再试");
    case 429:
      return new AIError("rate_limit", "请求太频繁或额度用完了，请过一会儿再试");
    case 529:
    case 503:
      return new AIError("overloaded", "AI 服务现在太忙，请稍后再试");
    default:
      return status >= 500
        ? new AIError("server", "AI 服务暂时出错，请稍后再试")
        : new AIError("http", `请求失败（${status}）${apiMessage ? "：" + apiMessage : ""}`);
  }
}
