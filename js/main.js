// 启动入口
import { startRouter } from "./router.js";
import * as home from "./pages/home.js";
import * as directory from "./pages/directory.js";
import * as settings from "./pages/settings.js";

const routes = {
  "home": home,
  "directory": directory,
  "settings": settings,
};

startRouter(routes, document.getElementById("page"));
