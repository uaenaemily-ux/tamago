// 首页：HERO_DAYS 天内（含当天）过生日的人以大蛋展示"Today!" / "In X Days"，
// 多人时左右滑动；区间内其他人以小蛋横排；区间内没人时显示下一个最近的生日。
import { el } from "../ui/dom.js";
import { egg } from "../ui/egg.js";
import { getState, listPeople } from "../store.js";
import { upcomingBirthdays, ordinal } from "../dates.js";

// 几天内（含当天）过生日的人放进大蛋区；想调整改这里
const HERO_DAYS = 3;

export function render(container) {
  const { rangeDays } = getState().settings;
  const people = listPeople();
  const { featured, others, next } = upcomingBirthdays(people, { heroDays: HERO_DAYS, rangeDays });

  container.append(el("h1", { class: "home-logo" },
    el("img", { src: "assets/logo.png", alt: "tamago", width: 240, height: 82 }),
  ));

  if (!people.length) {
    container.append(emptyCard(
      "还没有守护蛋",
      "登记朋友和家人的生日，快过生日时会在这里提醒你。",
    ));
    return;
  }

  if (!featured.length) {
    container.append(emptyCard(
      `${rangeDays} 天内没有人过生日`,
      "可以趁现在给大家补充一些喜好标签。",
      next,
    ));
    return;
  }

  container.append(hero(featured));
  if (others.length) container.append(othersCard(others, rangeDays));
}

// ---------- 大蛋 ----------
function hero(entries) {
  const slides = entries.map((entry) =>
    el("a", {
      class: "hero-slide",
      href: `#/person/${encodeURIComponent(entry.person.id)}`,
      "aria-label": `${entry.person.name}，${daysLabelZh(entry.daysUntil)}`,
    },
      el("p", { class: "hero-days num" }, daysLabel(entry.daysUntil)),
      // 光晕放在外层，用圆形渐变（不用 filter，iPhone 上会被裁成方框）
      el("span", { class: "hero-egg" },
        egg(entry.person.eggColor, {
          size: 150,
          className: entry.daysUntil === 0 ? "egg-celebrate" : "",
        }),
      ),
      el("p", { class: "hero-title" }, birthdayTitle(entry)),
      el("p", { class: "muted" }, `${entry.date.month}月${entry.date.day}日 · ${daysLabelZh(entry.daysUntil)}`),
    ));

  const track = el("div", { class: "hero-track" }, ...slides);
  const card = el("section", { class: "card card-sparkles hero" }, track);

  // 多人：左右滑动 + 底部小圆点
  if (entries.length > 1) {
    const sameDay = entries.every((e) => e.daysUntil === entries[0].daysUntil);
    const dots = entries.map((_, i) => el("span", { class: i === 0 ? "dot is-active" : "dot" }));
    card.append(
      el("div", { class: "dots", "aria-hidden": "true" }, ...dots),
      el("p", { class: "muted hero-hint" },
        sameDay
          ? `${entries.length} 个人同一天过生日，左右滑动看看`
          : `最近有 ${entries.length} 个人过生日，左右滑动看看`),
    );
    track.addEventListener("scroll", () => {
      const index = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
    }, { passive: true });
  }

  return card;
}

// ---------- 小蛋 ----------
function othersCard(entries, rangeDays) {
  return el("section", { class: "card" },
    el("h2", {}, el("span", { class: "deco deco-star" }), ` ${rangeDays} 天内还有`),
    el("div", { class: "mini-eggs" },
      ...entries.map((entry) =>
        el("a", { class: "mini-egg", href: `#/person/${encodeURIComponent(entry.person.id)}` },
          egg(entry.person.eggColor, { size: 48 }),
          el("span", { class: "egg-name" }, entry.person.name),
          el("span", { class: "mini-days num" }, `${entry.daysUntil} 天`),
        )),
    ),
  );
}

// ---------- 空状态 ----------
function emptyCard(title, text, next = null) {
  return el("section", { class: "card card-sparkles empty" },
    el("div", { class: "angel" },
      el("span", { class: "deco deco-wing deco-wing-left" }),
      el("span", { class: "deco deco-heart" }),
      el("span", { class: "deco deco-wing" }),
    ),
    el("h2", {}, title),
    el("p", { class: "muted" }, text),
    next ? el("a", { class: "next-birthday", href: `#/person/${encodeURIComponent(next.person.id)}` },
      egg(next.person.eggColor, { size: 40 }),
      el("span", {},
        "下一个是 ", el("strong", {}, next.person.name), "，",
        `${next.date.month}月${next.date.day}日，还有 ${next.daysUntil} 天`,
      ),
    ) : null,
    el("a", { class: "btn btn-primary", href: "#/directory" }, next ? "去目录看看" : "去目录登记"),
  );
}

// ---------- 文案 ----------
function daysLabel(days) {
  if (days === 0) return "Today!";
  return days === 1 ? "In 1 Day" : `In ${days} Days`;
}

function daysLabelZh(days) {
  return days === 0 ? "就是今天！" : `还有 ${days} 天`;
}

// "Mary's 26th Birthday"；不知道年龄时 "Mary's Birthday"
function birthdayTitle({ person, turningAge }) {
  const age = turningAge != null && turningAge > 0 ? `${ordinal(turningAge)} ` : "";
  return `${person.name}'s ${age}Birthday`;
}
