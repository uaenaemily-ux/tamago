"""小屏检查：用 320px 宽的手机屏幕打开每个页面和弹窗，检查有没有横向滚动、有没有元素超出屏幕，并截图。

用法（先运行 python3 tools/serve.py 启动本地预览）：
    python3 tools/check-layout.py 截图文件夹           # 默认 320 宽
    python3 tools/check-layout.py 截图文件夹 --width 375

每个场景都用全新的临时浏览器（互不影响，不碰你自己的数据），AI 回答用假的（不联网、不花钱）。
新增页面或弹窗时，在下面的 SCENARIOS 里加一项。
"""
import argparse
import base64
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("shot", ROOT / "tools" / "screenshot.py")
shot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shot)

# ---------- 准备数据（在网页里用网页自己的代码执行） ----------
IMPORTS = "const s = await import('/js/store.js'); const d = await import('/js/sample-data.js');"
SETUPS = {
    "none": None,
    "onboarded": f"(async () => {{ {IMPORTS} await s.updateSettings({{ onboarded: true }}); return true; }})()",
    "sample": f"""(async () => {{ {IMPORTS}
        await s.loadSampleData(d.buildSampleData()); await s.updateSettings({{ apiKey: 'sk-ant-FAKE' }}); return true; }})()""",
    # 只有一个人，生日在 60 天后（首页"30 天内没有人过生日"）
    "far": f"""(async () => {{ {IMPORTS}
        const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 60);
        await s.updateSettings({{ onboarded: true }});
        await s.addPerson({{ name: '名字特别特别长的朋友Alexandria', category: 'friend',
          birthday: {{ year: null, month: f.getMonth() + 1, day: f.getDate() === 29 && f.getMonth() === 1 ? 28 : f.getDate() }} }});
        return true; }})()""",
}

# ---------- 页面上的操作 ----------
FIND = "const btn = (t) => [...document.querySelectorAll('button, a')].find(b => b.textContent.trim() === t);"
FAKE_AI = """
  const plans = { plans: [
    { label: 'A', name: '芭蕾舞鞋造型的珍珠发夹套装（一对，附丝绒收纳袋）', category: '饰品', priceRange: '约 260 元', style: '日常可用',
      reason: '小桃喜欢芭蕾风，这套发夹把芭蕾舞鞋和珍珠结合在一起，日常扎头发就能戴，比去年的挂件更显眼又不夸张。', matchedTags: ['芭蕾风'], sameCategoryGiftIds: [] },
    { label: 'B', name: '一卷彩色胶卷 + 冲洗券 + 手作相册', category: '体验', priceRange: '350–450 元', style: '纪念意义',
      reason: '她在玩胶片相机，送胶卷和冲洗券能直接用上。', matchedTags: ['胶片相机'], sameCategoryGiftIds: [] } ] };
  const ideas = { ideas: [
    { title: '珍珠 + 缎带的芭蕾风发夹（一对）', note: '和她的芭蕾风穿搭最搭。', keywords: ['芭蕾风 珍珠发夹', 'ballet pearl hair clip'] },
    { title: '芭蕾舞鞋造型的金属发夹', note: '小巧精致。', keywords: ['芭蕾舞鞋 发夹'] },
    { title: '粉色缎面大肠发圈套装', note: '扎头发更有芭蕾感。', keywords: ['缎面 发圈 芭蕾'] } ] };
  window.fetch = async (u, init) => { const b = JSON.parse(init.body); const isIdeas = b.system.includes('展开 3–5 个');
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(isIdeas ? ideas : plans) }], stop_reason: 'end_turn' })); };
"""
WAIT = "const wait = (ok) => new Promise(r => { const t = setInterval(() => { if (ok()) { clearInterval(t); r(); } }, 100); setTimeout(() => { clearInterval(t); r(); }, 5000); });"


def person_route(name, prefix="#/person/"):
    """跳到示例数据里某人的页面（先读出 id）"""
    return f"""(async () => {{ const s = await import('/js/store.js');
        location.hash = '{prefix}' + s.getState().people.find(p => p.name === '{name}').id; return true; }})()"""


SCENARIOS = [
    # (名字, 准备数据, 打开的地址, 打开后执行的操作)
    ("01-欢迎页", "none", "#/welcome", None),
    ("02-首页-还没有守护蛋", "onboarded", "#/home", None),
    ("03-首页-大蛋和小蛋", "sample", "#/home", None),
    ("04-首页-30天内没人", "far", "#/home", None),
    ("05-目录", "sample", "#/directory", None),
    ("06-登记弹窗", "sample", "#/directory", f"{FIND} btn('添加').click();"),
    ("07-详情页", "sample", None, person_route("小桃")),
    ("08-添加礼物弹窗", "sample", None, person_route("小桃") + f"; setTimeout(() => {{ {FIND} document.querySelector('.gift-circle-add').closest('button').click(); }}, 800)"),
    ("09-礼物详情弹窗", "sample", None, person_route("小桃") + "; setTimeout(() => document.querySelector('.gift-tile').click(), 800)"),
    ("10-纪念日弹窗", "sample", None, person_route("小桃") + f"; setTimeout(() => {{ {FIND} btn('添加纪念日').click(); }}, 800)"),
    ("11-删除确认", "sample", None, person_route("小桃") + f"; setTimeout(() => {{ {FIND} btn('删除').click(); }}, 800)"),
    ("12-孵化-选择", "sample", None, person_route("小桃", "#/incubate/")),
    ("13-孵化-结果和灵感清单", "sample", None, person_route("小桃", "#/incubate/") + f"""; setTimeout(async () => {{ {FIND} {WAIT} {FAKE_AI}
        document.querySelector('input[name=budget]').click(); btn('开始孵化').click();
        await wait(() => document.querySelector('.plan-card'));
        btn('不喜欢') && document.querySelectorAll('.plan-card')[1].querySelector('.btn-ghost').click();
        btn('我更喜欢这个！').click(); await wait(() => btn('展开灵感清单')); btn('展开灵感清单').click(); }}, 800)"""),
    ("13b-孵化-孵化中", "sample", None, person_route("小桃", "#/incubate/") + f"""; setTimeout(() => {{ {FIND}
        window.fetch = () => new Promise(() => {{}});
        document.querySelector('input[name=budget]').click(); btn('开始孵化').click(); }}, 800)"""),
    ("14-孵化-出错", "sample", None, person_route("小桃", "#/incubate/") + f"""; setTimeout(() => {{ {FIND}
        window.fetch = async () => new Response(JSON.stringify({{ error: {{ message: 'invalid x-api-key' }} }}), {{ status: 401 }});
        document.querySelector('input[name=budget]').click(); btn('开始孵化').click(); }}, 800)"""),
    ("15-设置", "sample", "#/settings", None),
]

# 横向溢出检查：页面宽度 + 超出屏幕的元素（可以左右滑动的区域里面的不算）
CHECK = """
(() => {
  const vw = document.documentElement.clientWidth;
  const sw = document.documentElement.scrollWidth;
  const inScroller = (e) => e.closest('.hero-track, .mini-eggs');
  const offenders = [...document.querySelectorAll('body *')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5) && !inScroller(e); })
    .slice(0, 8)
    .map((e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : ''}（右边 ${Math.round(e.getBoundingClientRect().right)}）`);
  return { vw, sw, offenders };
})()
"""


def open_browser():
    profile = tempfile.mkdtemp(prefix="tamago-layout-")
    chrome = subprocess.Popen(
        [shot.CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
         f"--user-data-dir={profile}", "--remote-debugging-port=0", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    port_file = os.path.join(profile, "DevToolsActivePort")
    for _ in range(100):
        if os.path.exists(port_file) and open(port_file).read().strip():
            break
        time.sleep(0.1)
    port = open(port_file).read().split()[0]
    targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list"))
    page = shot.Page(next(t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page"))
    return chrome, profile, page


def run(name, setup, route, action, width, out_dir):
    chrome, profile, page = open_browser()
    try:
        page.call("Emulation.setDeviceMetricsOverride", width=width, height=640, deviceScaleFactor=2, mobile=True)
        # 截图时用静态效果，避免截到动画中间
        page.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-reduced-motion", "value": "reduce"}])
        page.call("Page.enable")
        if SETUPS[setup]:
            page.call("Page.navigate", url=shot.BASE_URL + "#/welcome")
            shot.wait_until_ready(page)
            page.evaluate(SETUPS[setup])
            page.call("Page.navigate", url="about:blank")
        page.call("Page.navigate", url=shot.BASE_URL + (route or "#/home"))
        shot.wait_until_ready(page)
        if action:
            page.evaluate(action)
            time.sleep(3)
            shot.wait_until_ready(page)
        time.sleep(0.6)
        result = page.evaluate(CHECK)
        modal_open = page.evaluate("!!document.querySelector('.modal')")
        height = 640 if modal_open else max(640, page.evaluate("document.documentElement.scrollHeight"))
        page.call("Emulation.setDeviceMetricsOverride", width=width, height=height, deviceScaleFactor=2, mobile=True)
        time.sleep(0.5)
        data = page.call("Page.captureScreenshot", format="png")["data"]
        (out_dir / f"{name}.png").write_bytes(base64.b64decode(data))
        return result
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=5)
        except subprocess.TimeoutExpired:
            chrome.kill()
        shutil.rmtree(profile, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("--width", type=int, default=320)
    args = ap.parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    problems = 0
    for name, setup, route, action in SCENARIOS:
        r = run(name, setup, route, action, args.width, out_dir)
        ok = r["sw"] <= r["vw"] and not r["offenders"]
        problems += not ok
        print(f"{'✅' if ok else '❌'} {name}：页面宽 {r['sw']} / 屏幕宽 {r['vw']}")
        for o in r["offenders"]:
            print(f"     超出屏幕：{o}")
    print(f"\n共 {len(SCENARIOS)} 个场景，{problems} 个有问题；截图在 {out_dir}")


if __name__ == "__main__":
    main()
