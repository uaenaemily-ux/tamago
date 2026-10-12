// 欢迎页：仅首次打开时显示。登记第一颗守护蛋，或载入示例先体验。
import { el } from "../ui/dom.js";
import { egg } from "../ui/egg.js";
import { showToast } from "../ui/toast.js";
import { updateSettings, loadSampleData } from "../store.js";
import { buildSampleData } from "../sample-data.js";
import { openFriendForm } from "../modals/friend-form.js";

// 欢迎页不显示底部导航
export const hideNav = true;

export function render(container) {
  const startBtn = el("button", { class: "btn btn-primary btn-wide", type: "button" }, "登记第一颗守护蛋");
  const sampleBtn = el("button", { class: "btn btn-wide", type: "button" }, "载入示例");
  const skipLink = el("button", { class: "link-button", type: "button" }, "先随便看看");

  startBtn.addEventListener("click", () => {
    openFriendForm({
      onSaved: async () => {
        await finishOnboarding();
      },
    });
  });

  sampleBtn.addEventListener("click", async () => {
    sampleBtn.disabled = true;
    try {
      const { people } = await loadSampleData(buildSampleData());
      showToast(`已载入 ${people} 颗示例守护蛋，可以在设置页一键清除`);
      location.hash = "#/home";
    } catch (err) {
      showToast(err.message);
      sampleBtn.disabled = false;
    }
  });

  skipLink.addEventListener("click", () => finishOnboarding());

  container.append(
    el("section", { class: "welcome" },
      el("img", { class: "welcome-logo", src: "assets/logo.png", alt: "tamago", width: 260, height: 89 }),
      // 白色空白蛋 + 左右两只像素翅膀（分开定位，和蛋之间留空隙；比例见 CSS 变量）
      el("div", { class: "welcome-hero" },
        // 蛋和翅膀放在同一个容器里一起浮动
        el("div", { class: "welcome-float" },
          el("span", { class: "wing wing-left", "aria-hidden": "true" }),
          egg("#FFFFFF", { size: 140, className: "egg-blank" }),
          el("span", { class: "wing wing-right", "aria-hidden": "true" }),
        ),
      ),
      el("p", { class: "welcome-tagline" }, "每个朋友都是一颗守护蛋"),
      el("ul", { class: "welcome-points" },
        point("deco-heart", "记下生日、喜好和送过的礼物"),
        point("deco-star", "生日快到时，打开就能看到"),
        point("deco-gift", "用 AI 孵化贴合 TA 的礼物灵感"),
      ),
      el("div", { class: "welcome-actions" }, startBtn, sampleBtn, skipLink),
      el("p", { class: "muted welcome-note" }, "所有数据只保存在这台设备的浏览器里，不需要注册。"),
    ),
  );
}

function point(deco, text) {
  return el("li", {}, el("span", { class: `deco ${deco}` }), text);
}

async function finishOnboarding() {
  try {
    await updateSettings({ onboarded: true });
  } catch (err) {
    showToast(err.message);
    return;
  }
  location.hash = "#/home";
}
