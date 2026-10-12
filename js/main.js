// 启动入口：读取本地数据 → 申请持久存储 → 启动页面路由
import { startRouter } from "./router.js";
import { loadState, requestPersistentStorage, updateSettings } from "./store.js";
import { el } from "./ui/dom.js";
import * as home from "./pages/home.js";
import * as directory from "./pages/directory.js";
import * as settings from "./pages/settings.js";
import * as detail from "./pages/detail.js";
import * as welcome from "./pages/welcome.js";
import * as incubator from "./pages/incubator.js";

const routes = {
  "home": home,
  "directory": directory,
  "settings": settings,
  "person/:id": detail,
  "welcome": welcome,
  "incubate/:id": incubator,
};

const container = document.getElementById("page");

async function start() {
  let state;
  try {
    state = await loadState();
  } catch (err) {
    showStartupError(err);
    return;
  }

  // 第一次打开：显示欢迎页。已经有数据的（欢迎页上线前登记的）直接算看过
  if (!state.settings.onboarded) {
    if (state.people.length) {
      await updateSettings({ onboarded: true }).catch(() => {});
    } else {
      location.hash = "#/welcome";
    }
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
