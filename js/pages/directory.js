// 目录页：Friends 和 Family 两个分区，每人一颗带名字的蛋；末尾"+"添加；人多时分页。
import { el } from "../ui/dom.js";
import { egg } from "../ui/egg.js";
import { listPeople } from "../store.js";
import { openFriendForm } from "../modals/friend-form.js";
import { refresh } from "../router.js";

const PAGE_SIZE = 8; // 每页 8 颗蛋 + 1 个"+"，正好 3×3

const SECTIONS = [
  { category: "friend", title: "Friends", deco: "deco-star", empty: "还没有朋友的守护蛋" },
  { category: "family", title: "Family", deco: "deco-heart", empty: "还没有家人的守护蛋" },
];

// 记住每个分区翻到第几页（刷新页面后回到第 1 页）
const pageOf = { friend: 0, family: 0 };

export function render(container) {
  container.append(
    el("h1", { class: "page-title" }, "目录"),
    ...SECTIONS.map(section),
  );
}

function section({ category, title, deco, empty }) {
  const people = [...listPeople(category)]
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));

  const pages = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const page = Math.min(pageOf[category], pages - 1);
  const shown = people.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const addTile = el("button", {
    class: "egg-tile egg-tile-add", type: "button", "aria-label": `添加${title === "Friends" ? "朋友" : "家人"}`,
    onClick: () => openFriendForm({ category, onSaved: () => refresh() }),
  },
    el("span", { class: "egg-add-icon", "aria-hidden": "true" }, "+"),
    el("span", { class: "egg-name" }, "添加"),
  );

  return el("section", { class: "card" },
    el("h2", { class: "section-title" },
      el("span", { class: `deco ${deco}` }), ` ${title}`,
      el("span", { class: "count num" }, String(people.length)),
    ),
    people.length ? null : el("p", { class: "muted" }, `${empty}，点"+"登记一颗吧`),
    el("div", { class: "egg-grid" },
      ...shown.map((person) =>
        el("a", { class: "egg-tile", href: `#/person/${encodeURIComponent(person.id)}` },
          egg(person.eggColor, { size: 56 }),
          el("span", { class: "egg-name" }, person.name),
        )),
      addTile,
    ),
    pages > 1 ? pager(category, page, pages) : null,
  );
}

function pager(category, page, pages) {
  const go = (p) => () => {
    pageOf[category] = p;
    refresh();
  };
  return el("div", { class: "pager" },
    el("button", { class: "btn btn-small", type: "button", disabled: page === 0, onClick: go(page - 1), "aria-label": "上一页" }, "‹"),
    el("span", { class: "num" }, `${page + 1} / ${pages}`),
    el("button", { class: "btn btn-small", type: "button", disabled: page === pages - 1, onClick: go(page + 1), "aria-label": "下一页" }, "›"),
  );
}
