// 购物平台搜索链接配置。想增加 / 删除 / 调整顺序，只改下面这个列表。
//
// url：电脑上用的搜索网页模板，{q} 会被替换成（经过编码的）搜索关键词，必须以 https:// 开头。
// appUrl（可选）：手机上优先尝试打开 App 的地址模板，开头必须在下面的 APP_SCHEMES 白名单里。
//   这些 App 地址不是平台官方公开的格式（来自社区整理），App 更新后可能失效，所以一定要配 mobileFallback。
// mobileFallback：手机上 App 没打开时怎么办
//   "web"：显示"打开网页版"链接（手机网页版能搜索的平台，如淘宝）
//   "copy"：打开 App 前先复制关键词，提示去 App 里粘贴搜索（手机网页版不能搜索的平台，如小红书）
//
// 网址只由这里的模板和关键词拼成，AI 不生成任何链接或网址。
export const SHOP_PLATFORMS = [
  {
    id: "taobao", name: "淘宝",
    url: "https://s.taobao.com/search?q={q}",
    appUrl: "taobao://s.taobao.com/search?q={q}",
    mobileFallback: "web",
  },
  {
    id: "xiaohongshu", name: "小红书",
    url: "https://www.xiaohongshu.com/search_result?keyword={q}",
    appUrl: "xhsdiscover://search/result?keyword={q}",
    mobileFallback: "copy",
  },
  { id: "amazon", name: "Amazon", url: "https://www.amazon.com/s?k={q}" },
];

// 允许的 App 地址开头（防止配置里混进 javascript: 之类的危险地址）
const APP_SCHEMES = ["taobao", "xhsdiscover"];

function fill(template, keyword) {
  return template.replace("{q}", encodeURIComponent(keyword.trim()));
}

// 搜索网页地址；模板不是 https 开头时返回 null（防止配置写错）
export function buildSearchUrl(platform, keyword) {
  if (!/^https:\/\//.test(platform.url || "") || !platform.url.includes("{q}")) return null;
  return fill(platform.url, keyword);
}

// App 地址；没有配置、或开头不在白名单里时返回 null
export function buildAppUrl(platform, keyword) {
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(platform.appUrl || "")?.[1]?.toLowerCase();
  if (!scheme || !APP_SCHEMES.includes(scheme) || !platform.appUrl.includes("{q}")) return null;
  return fill(platform.appUrl, keyword);
}

// 这个平台在当前设备上怎么用："app" 先尝试打开 App，"link" 打开搜索网页
export function platformAction(platform, mobile = isMobileDevice()) {
  return mobile && buildAppUrl(platform, "x") ? "app" : "link";
}

// 是否手机 / 平板（iPad 的 Safari 会伪装成 Mac，用触摸点数量区分）
export function isMobileDevice(nav = globalThis.navigator) {
  const ua = nav?.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
}
