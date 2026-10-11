// hash 路由：#/home、#/person/abc → 找到对应页面并渲染
// routes 例子：{ "home": homePage, "person/:id": detailPage }

let renderCurrent = () => {};

// 重新渲染当前页面（数据变化后调用）
export function refresh() {
  renderCurrent();
}

export function startRouter(routes, container, fallback = "home") {
  renderCurrent = render;

  function render() {
    const path = location.hash.replace(/^#\/?/, "") || fallback;
    const match = findRoute(routes, path);

    if (!match) {
      location.hash = `#/${fallback}`;
      return;
    }

    const isSamePage = path === currentPath;
    currentPath = path;
    container.replaceChildren();
    if (!isSamePage) window.scrollTo(0, 0); // 刷新同一页时保持滚动位置
    match.page.render(container, match.params);
    // 页面可以用 navSection 指定高亮哪个导航（如详情页高亮"目录"）
    highlightNav(match.page.navSection || path.split("/")[0]);
  }

  let currentPath = null;
  window.addEventListener("hashchange", render);
  render();
}

function findRoute(routes, path) {
  const parts = path.split("/");
  for (const [pattern, page] of Object.entries(routes)) {
    const patternParts = pattern.split("/");
    if (patternParts.length !== parts.length) continue;

    const params = {};
    const ok = patternParts.every((p, i) => {
      if (p.startsWith(":")) {
        params[p.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      }
      return p === parts[i];
    });
    if (ok) return { page, params };
  }
  return null;
}

function highlightNav(section) {
  document.querySelectorAll(".nav-item").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.route === section);
  });
}
