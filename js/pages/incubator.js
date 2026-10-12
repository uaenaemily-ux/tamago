// AI 灵感孵化页：选预算和场合（可加提示词）→ 孵化动画 → Plan A / Plan B
// 每个方案：我更喜欢这个！/ 不喜欢 / 就送这个；选定喜欢的方案后可"展开灵感清单"（具体方向 + 购物平台搜索链接）
// 结果下方可以再给提示词继续 brainstorm；同一次孵化里重新孵化会避开推荐过的和不喜欢的方案。
import { el } from "../ui/dom.js";
import { egg } from "../ui/egg.js";
import { showToast } from "../ui/toast.js";
import { photoImg } from "../photos.js";
import { getPerson, listGifts, getState, addGift, addPreference, suggestOccasions } from "../store.js";
import { todayISO } from "../dates.js";
import { BUDGETS, findBudget, incubate, expandIdeas, parseHints, planSummary } from "../incubator-logic.js";
import { SHOP_PLATFORMS, buildSearchUrl, buildAppUrl, platformAction } from "../shop-platforms.js";
import { copyText } from "../ui/clipboard.js";

export const navSection = "directory";

// 每个人这次孵化的状态（离开页面再回来时保留；刷新网页后重置）
//   budget / occasion / hints：上次的选择
//   shown：这次已经推荐过的方案；disliked：标记为不喜欢的方案
const sessions = {};

export function render(container, { id }) {
  const person = getPerson(id);
  if (!person) {
    container.append(
      el("h1", { class: "page-title" }, "找不到"),
      el("div", { class: "card empty" },
        el("p", {}, "这颗守护蛋不存在，可能已经被删除了。"),
        el("a", { class: "btn btn-primary", href: "#/directory" }, "回到目录"),
      ),
    );
    return;
  }

  const view = el("div");
  container.append(
    el("a", { class: "back-link", href: `#/person/${encodeURIComponent(person.id)}` }, `‹ ${person.name}`),
    el("h1", { class: "page-title" }, "灵感孵化"),
    view,
  );

  const session = sessions[person.id] || (sessions[person.id] = {
    budget: null, occasion: "生日", hints: [], shown: [], disliked: [],
  });
  // 防止旧请求的结果覆盖新页面
  let runId = 0;

  showForm();

  // ---------- 第一步：选预算和场合 ----------
  function showForm() {
    runId++;
    const hasKey = Boolean(getState().settings.apiKey);

    const budgetGroup = el("div", { class: "choice-grid", role: "radiogroup", "aria-label": "预算" },
      ...BUDGETS.map((b) => {
        const input = el("input", { type: "radio", name: "budget", value: b.id, checked: session.budget === b.id });
        input.addEventListener("change", () => { session.budget = b.id; });
        return el("label", { class: "choice" }, input, el("span", { class: "num" }, `¥ ${b.label}`));
      }),
    );

    const occasionInput = el("input", {
      class: "input", type: "text", maxlength: 20, value: session.occasion,
      "aria-label": "场合", placeholder: "比如：生日",
    });
    occasionInput.addEventListener("input", () => { session.occasion = occasionInput.value; });
    const occasionChips = el("div", { class: "chips" },
      ...suggestOccasions().slice(0, 7).map((o) =>
        el("button", {
          class: "chip chip-button", type: "button",
          onClick: () => { occasionInput.value = o; session.occasion = o; },
        }, o)),
    );

    const hintsInput = el("input", {
      class: "input", type: "text", maxlength: 80, value: session.hints.join("、"),
      "aria-label": "提示词", placeholder: "比如：可爱、小众、能天天用",
    });

    const error = el("p", { class: "form-error", role: "alert", hidden: true });
    const startBtn = el("button", { class: "btn btn-primary btn-wide", type: "button", disabled: !hasKey }, "开始孵化");
    startBtn.addEventListener("click", () => {
      if (!session.budget) {
        error.textContent = "请先选一个预算区间";
        error.hidden = false;
        return;
      }
      session.occasion = occasionInput.value.trim() || "生日";
      session.hints = parseHints(hintsInput.value);
      run();
    });

    // 注意：浏览器的 replaceChildren 会把 null 显示成文字 "null"，所以先过滤掉
    view.replaceChildren(...[
      el("section", { class: "card incubator-head" },
        egg(person.eggColor, { size: 64 }),
        el("div", {},
          el("h2", {}, `为 ${person.name} 孵化礼物灵感`),
          el("p", { class: "muted" }, "AI 会参考 TA 的喜好标签和送礼记录，给出两个不同方向的方案。"),
        ),
      ),
      person.tags.length ? null : el("p", { class: "notice" },
        "TA 还没有喜好标签，多添加几个，灵感会更准哦。也可以直接继续。",
        el("a", { href: `#/person/${encodeURIComponent(person.id)}` }, "去添加标签"),
      ),
      hasKey ? null : el("p", { class: "notice" },
        "还没有填写 API 密钥，孵化需要先在设置页填写。",
        el("a", { href: "#/settings" }, "去设置"),
      ),
      el("section", { class: "card" },
        error,
        el("div", { class: "field" }, el("span", { class: "field-label" }, "预算（人民币）"), budgetGroup),
        el("div", { class: "field" }, el("span", { class: "field-label" }, "场合"), occasionInput, occasionChips),
        el("label", { class: "field" },
          el("span", { class: "field-label" }, "额外提示词（选填）"),
          hintsInput,
          el("span", { class: "field-hint" }, "想让 AI 往哪个方向想，用逗号或空格分开"),
        ),
        el("div", { class: "card-actions" }, startBtn),
      ),
    ].filter(Boolean));
  }

  // ---------- 第二步：孵化 ----------
  async function run() {
    const myRun = ++runId;
    view.replaceChildren(
      el("section", { class: "card hatching", role: "status" },
        el("div", { class: "hatching-egg" }, egg(person.eggColor, { size: 120, className: "egg-shake" })),
        el("p", { class: "hatching-text" }, "孵化中…"),
        el("p", { class: "muted" }, "通常需要十几秒到半分钟"),
      ),
    );

    let plans;
    try {
      plans = await incubate({
        person: getPerson(person.id),
        gifts: listGifts(person.id),
        budget: findBudget(session.budget),
        occasion: session.occasion,
        hints: session.hints,
        avoid: session.shown,
        disliked: session.disliked,
      });
    } catch (err) {
      if (myRun === runId) showError(err);
      return;
    }
    if (myRun !== runId) return;
    session.shown.push(...plans.map(planSummary));
    showResults(plans);
  }

  // ---------- 出错 ----------
  function showError(err) {
    const needsSettings = ["no_key", "auth", "permission", "not_found", "billing"].includes(err.code);
    view.replaceChildren(
      el("section", { class: "card empty" },
        el("div", { class: "hatching-egg" }, egg(person.eggColor, { size: 72 })),
        el("h2", {}, "这次没孵化出来"),
        el("p", {}, err.message || "出了点问题，请重新孵化"),
        el("div", { class: "card-actions center" },
          el("button", { class: "btn btn-primary", type: "button", onClick: run }, "重新孵化"),
          el("button", { class: "btn", type: "button", onClick: showForm }, "修改预算和场合"),
          needsSettings ? el("a", { class: "btn btn-ghost", href: "#/settings" }, "去设置") : null,
        ),
      ),
    );
    if (!err.code) console.error(err);
  }

  // ---------- 第三步：结果 ----------
  function showResults(plans) {
    const budget = findBudget(session.budget);
    const personTags = new Set(getPerson(person.id)?.tags || []);
    const cards = [];
    let preferred = null;

    plans.forEach((plan, i) => {
      const other = plans[1 - i];
      const tags = plan.matchedTags.filter((t) => personTags.has(t));

      const preferBtn = el("button", { class: "btn btn-small", type: "button" }, "我更喜欢这个！");
      const dislikeBtn = el("button", { class: "btn btn-small btn-ghost", type: "button" }, "不喜欢");
      const giveBtn = el("button", { class: "btn btn-primary btn-small", type: "button" }, "就送这个");
      const status = el("p", { class: "plan-status", role: "status" });
      const ideasBox = el("div", { class: "ideas" });

      const card = el("section", { class: "card plan-card" },
        el("div", { class: "plan-head" },
          el("span", { class: "plan-label num" }, `Plan ${plan.label}`),
          el("span", { class: "plan-style" }, plan.style),
        ),
        el("h2", { class: "plan-name" }, plan.name),
        el("p", { class: "plan-meta" },
          el("span", { class: "chip" }, plan.category),
          el("span", { class: "plan-price" }, plan.priceRange),
        ),
        el("p", { class: "plan-reason" }, plan.reason),
        tags.length ? el("div", { class: "chips" }, ...tags.map((t) => el("span", { class: "chip chip-tag" }, t))) : null,
        plan.sameCategoryGifts.length ? sameCategoryNotice(plan) : null,
        el("div", { class: "card-actions" }, preferBtn, dislikeBtn, giveBtn),
        status,
        ideasBox,
      );
      cards.push({ card, preferBtn, dislikeBtn });

      // 我更喜欢这个！：记录选择，并出现"展开灵感清单"
      preferBtn.addEventListener("click", async () => {
        if (preferred) return;
        preferred = plan;
        try {
          await addPreference({ personId: person.id, type: "prefer", chosen: planSummary(plan), rejected: planSummary(other) });
        } catch (err) {
          showToast(err.message);
        }
        card.classList.add("is-preferred");
        cards.forEach((c) => { c.preferBtn.disabled = true; });
        dislikeBtn.disabled = true;
        preferBtn.textContent = "♡ 已记下";
        ideasBox.replaceChildren(expandButton(plan, ideasBox));
      });

      // 不喜欢：记录下来，同一次孵化里重新孵化时避开
      dislikeBtn.addEventListener("click", async () => {
        dislikeBtn.disabled = true;
        preferBtn.disabled = true;
        try {
          await addPreference({ personId: person.id, type: "dislike", plan: planSummary(plan) });
        } catch (err) {
          showToast(err.message);
        }
        session.disliked.push(planSummary(plan));
        card.classList.add("is-disliked");
        status.textContent = "已记下不喜欢，重新孵化时会避开类似的方向。";
      });

      // 就送这个：登记到礼物墙
      giveBtn.addEventListener("click", async () => {
        giveBtn.disabled = true;
        try {
          await addGift({
            personId: person.id,
            name: plan.name,
            category: plan.category,
            date: todayISO(),
            occasion: session.occasion,
            source: "ai",
          });
          showToast("已登记到礼物墙，可以在礼物墙补充照片和对方反应");
          location.hash = `#/person/${encodeURIComponent(person.id)}`;
        } catch (err) {
          showToast(err.message);
          giveBtn.disabled = false;
        }
      });
    });

    const context = [`预算 ¥${budget.label}`, session.occasion, ...(session.hints.length ? [`提示词：${session.hints.join("、")}`] : [])];
    view.replaceChildren(
      el("p", { class: "muted result-context" }, context.join("・")),
      ...cards.map((c) => c.card),
      brainstormCard(),
      el("div", { class: "card-actions center" },
        el("button", { class: "btn", type: "button", onClick: run }, "都不满意，重新孵化"),
        el("button", { class: "btn btn-ghost", type: "button", onClick: showForm }, "修改预算和场合"),
      ),
      el("p", { class: "muted small-print" }, "灵感由 AI 生成，价格和是否有货请以实际购买渠道为准。"),
    );
  }

  // 继续 brainstorm：再给几个提示词，以这些词为基础重新孵化
  function brainstormCard() {
    const input = el("input", {
      class: "input", type: "text", maxlength: 80, "aria-label": "新的提示词",
      placeholder: "比如：手作、能一起用、复古",
    });
    const btn = el("button", { class: "btn btn-small", type: "button" }, "按这些词重新孵化");
    const go = () => {
      const hints = parseHints(input.value);
      if (!hints.length) {
        input.focus();
        showToast("先输入一两个提示词");
        return;
      }
      session.hints = hints;
      run();
    };
    btn.addEventListener("click", go);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) go();
    });
    return el("section", { class: "card brainstorm" },
      el("h2", {}, el("span", { class: "deco deco-sparkle" }), " 继续 brainstorm"),
      el("p", { class: "muted" }, "再给 AI 几个提示词，它会以这些为重点重新想，并避开已经推荐过和你不喜欢的方案。"),
      el("div", { class: "tag-entry" }, input, btn),
    );
  }

  // 展开灵感清单按钮 → 3–5 个具体方向 + 购物平台搜索链接
  function expandButton(plan, box) {
    const btn = el("button", { class: "btn btn-small btn-wide", type: "button" }, "展开灵感清单");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "正在展开…";
      try {
        const ideas = await expandIdeas({
          person: getPerson(person.id),
          plan,
          budget: findBudget(session.budget),
          occasion: session.occasion,
        });
        box.replaceChildren(ideasList(ideas));
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "再试一次：展开灵感清单";
        showToast(err.message);
      }
    });
    return btn;
  }

  function ideasList(ideas) {
    return el("div", { class: "ideas-list" },
      el("h3", { class: "ideas-title" }, el("span", { class: "deco deco-star" }), " 灵感清单"),
      el("ol", {},
        ...ideas.map((idea) =>
          el("li", { class: "idea" },
            el("p", { class: "idea-title" }, idea.title),
            idea.note ? el("p", { class: "muted idea-note" }, idea.note) : null,
            ...idea.keywords.map((k) => {
              // App 没打开时，在这一行下面显示备用提示
              const fallback = el("p", { class: "shop-fallback", role: "status" });
              return el("div", { class: "idea-search" },
                el("span", { class: "idea-keyword" }, `🔍 ${k}`),
                el("span", { class: "idea-links" }, ...SHOP_PLATFORMS.map((p) => shopButton(p, k, fallback))),
                fallback,
              );
            }),
          )),
      ),
      el("p", { class: "muted small-print" }, "链接是按关键词生成的平台搜索页，会在新标签页打开；手机上点淘宝、小红书会先尝试直接打开 App。"),
    );
  }

  // 一个平台按钮：电脑上是打开搜索网页的链接；手机上配置了 App 地址的平台（淘宝、小红书）先尝试打开 App
  function shopButton(platform, keyword, fallback) {
    if (platformAction(platform) === "app") {
      return el("button", {
        class: "shop-link", type: "button",
        onClick: () => openInApp(platform, keyword, fallback),
      }, platform.name);
    }
    const href = buildSearchUrl(platform, keyword);
    return href ? el("a", { class: "shop-link", href, target: "_blank", rel: "noopener noreferrer" }, platform.name) : null;
  }

  // 尝试打开 App；2 秒后页面还在（App 没打开）就显示备用方案
  function openInApp(platform, keyword, fallback) {
    fallback.replaceChildren();
    // 先开始复制（小红书的备用方案），但不等它：打开 App 必须在点击的当下立刻进行，否则 iPhone 可能拦截
    const copied = platform.mobileFallback === "copy" ? copyText(keyword) : Promise.resolve(false);

    let left = false;
    const onLeave = () => { left = true; };
    document.addEventListener("visibilitychange", onLeave);
    window.addEventListener("pagehide", onLeave);
    window.location.href = buildAppUrl(platform, keyword);

    setTimeout(async () => {
      document.removeEventListener("visibilitychange", onLeave);
      window.removeEventListener("pagehide", onLeave);
      if (left || document.visibilityState === "hidden") return; // 已经跳到 App 了
      if (platform.mobileFallback === "web") {
        const href = buildSearchUrl(platform, keyword);
        fallback.replaceChildren(
          `没有打开${platform.name} App？`,
          el("a", { href, target: "_blank", rel: "noopener noreferrer" }, "打开网页版"),
        );
      } else {
        fallback.textContent = (await copied)
          ? `没有打开${platform.name} App？关键词「${keyword}」已复制，可以手动打开${platform.name}粘贴搜索。`
          : `没有打开${platform.name} App？请手动复制「${keyword}」，到${platform.name}里搜索。`;
      }
    }, 2000);
  }

  // 同品类提醒：附上礼物墙里对应礼物的照片
  function sameCategoryNotice(plan) {
    return el("div", { class: "same-category" },
      el("p", {}, `提醒：你之前送过 ${person.name} 这些「${plan.category}」类的礼物，看看会不会重复——`),
      el("div", { class: "same-category-list" },
        ...plan.sameCategoryGifts.map((g) =>
          el("div", { class: "same-category-item" },
            el("span", { class: "gift-circle gift-circle-small" },
              g.photoId ? photoImg(g.photoId, { alt: "" }) : el("span", { class: "deco deco-gift" }),
            ),
            el("span", { class: "gift-name" }, g.name),
            g.date ? el("span", { class: "gift-year num" }, g.date.slice(0, 4)) : null,
          )),
      ),
    );
  }
}
