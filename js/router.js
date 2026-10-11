// hash 路由：#/home、#/person/abc → 找到对应页面并渲染
// routes 例子：{ "home": homePage, "person/:id": detailPage }

export function startRouter(routes, container, fallback = "home") {
  function render() {
    const path = location.hash.replace(/^#\/?/, "") || fallback;
    const match = findRoute(routes, path);

    if (!match) {
      location.hash = `#/${fallback}`;
      return;
    }

    container.replaceChildren();
    window.scrollTo(0, 0);
    match.page.render(container, match.params);
    highlightNav(path.split("/")[0]);
  }

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
