// 启动入口：读取本地数据 → 申请持久存储 → 启动页面路由
import { startRouter } from "./router.js";
import { loadState, requestPersistentStorage } from "./store.js";
import { el } from "./ui/dom.js";
import * as home from "./pages/home.js";
import * as directory from "./pages/directory.js";
import * as settings from "./pages/settings.js";

const routes = {
  "home": home,
  "directory": directory,
  "settings": settings,
};

const container = document.getElementById("page");

async function start() {
  try {
    await loadState();
  } catch (err) {
    showStartupError(err);
    return;
  }

  // 不用等结果，页面先显示
  requestPersistentStorage();

  startRouter(routes, container);
}

function showStartupError(err) {
  console.error(err);
  container.replaceChildren(
    el("h1", { class: "page-title" }, "出错了"),
    el("div", { class: "card" },
      el("p", {}, "本地数据读取失败，现有数据没有被改动。"),
      el("p", { class: "muted" }, err.message),
      el("p", { class: "muted" },
        "如果你在用无痕 / 隐私模式，请换成普通模式打开；也可以刷新页面再试一次。"),
    ),
  );
}

start();
