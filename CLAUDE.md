# tamago

> **始终用中文回复我，包括解释、计划和总结；代码、文件名和命令保持原样。**

送礼灵感与生日提醒的个人网页工具。需求见 docs/PRD.md。用户是编程新手：解释要通俗，改动要小步、可在手机上验证。

## 技术约束
- 纯静态：原生 HTML/CSS/JS（ES Modules），无框架、无 npm、无构建、无后端、无数据库
- 部署：GitHub Pages；路由使用 hash（#/home）
- 手机优先，最小宽度 320px 不出现横向滚动
- 本地预览：`python3 tools/serve.py`（禁止缓存，手机测试也能拿到最新文件），打开 http://localhost:8000；手机用电脑的局域网 IP（`ipconfig getifaddr en0`）
- 当前范围：只做 PRD 中的 P0

## 文件结构
- `index.html`：唯一的 HTML（底部导航 + 页面容器 + 弹窗容器）；`manifest.webmanifest`：添加到主屏幕
- `css/`：tokens.css（设计变量）、base.css、components.css
- `docs/BACKLOG.md`：待办清单（进行中 / 待办 / 已完成）；`docs/DEVLOG.md`：开发日志
- `js/backup.js`：导出 / 导入备份（导入前严格检查，任何一处不对就整份拒绝）
- `js/main.js` 启动；`router.js` hash 路由；`schema.js` 版本与迁移；`store.js` 数据读写；`dates.js` 日期计算；`photos.js` 照片压缩；`ai.js` 调用 AI；`incubator-logic.js` 孵化业务逻辑；`backup.js` 备份；`sample-data.js` 示例数据
- `js/ui/`：egg、modal、toast、confirm、dom（安全建元素 el()）
- `js/pages/`：welcome、home、directory、detail、incubator、settings
- `js/modals/`：friend-form、gift-form
- `js/vendor/idb-keyval.js`：本地保存的第三方库（6.2.1，Apache-2.0，授权见同目录 LICENSE），不走 CDN
- `tests/`：浏览器测试页，打开 http://localhost:8000/tests/ 自动运行；使用单独的测试数据库 "tamago-test"，不碰真实数据。修改 dates / schema / store 后要补测试并全部通过
- `fonts/`：QiuYeYuanTi-16.ttf（原字体，只用来截取）、tamago-title.woff2（网页实际加载的截取版）、OFL.txt（授权）
- `tools/subset-font.py`：截取标题字体；`tools/pixel-icons.py`：生成像素图标；`tools/pixelize.py`：把 AI 生成的像素风图片整理成真正的像素图
- `tools/screenshot.py`：截图（先启动 tools/serve.py）。`python3 tools/screenshot.py "#/welcome" 输出.png` 手机 390 宽；加 `--desktop` 为电脑 1280 宽，`--full` 截整页，`--sample` 先载入示例数据（全新浏览器没有数据会跳到欢迎页）。会等页面渲染、字体和图片都加载完再截；不要用 chrome --screenshot（会截到空白或缺图，且最小宽度约 500px）
- `assets/wing-left.png`、`assets/wing-right.png`：欢迎页左右两只像素翅膀（58×55、60×55），由 design-refs/wings-raw.png 经 pixelize.py（--block 12.5）整理、再用 `tools/split-wings.py` 从中间切开。欢迎页蛋和翅膀的比例都在 css/components.css 的 `.welcome-hero` 变量里（--egg-w、--wing-w-ratio、--wing-h-ratio、--wing-gap-ratio、--wing-y-ratio）
- `assets/deco/`：装饰图（手绘 hand-*、像素 pixel-*）；`assets/nav/`：导航图标
- `design-refs/`：美术参考图，已加入 .gitignore，不提交；只参考氛围，所有图案和插画必须原创

## 字体
- 正文：系统字体（苹方，非苹果设备退回微软雅黑 / 思源黑体 / 文泉驿），变量 `--font-body`
- 标题、数字、按钮：Tamago Title（「秋叶圆体 16」截取改名版），变量 `--font-title`；h1/h2/h3、.btn、.num 自动使用
- 点阵字体：字号只用 16 的倍数（16 / 32 / 48px），不加粗
- 授权：SIL OFL 1.1，作者保留名称「秋叶圆体 16」「QiuYeYuanTi 16」，截取版必须用别的名字，保留版权信息和 fonts/OFL.txt
- **新增或修改界面文案后，必须重新截取字体**：
  - 第一次使用（或换电脑）先安装工具：`python3 -m venv .venv && .venv/bin/pip install fonttools brotli`
  - 截取：`.venv/bin/python tools/subset-font.py`（扫描 index.html 的文字和 js/ 里字符串中的文字，不含注释和 js/vendor；覆盖生成 fonts/tamago-title.woff2）
- 用户输入的文字（如朋友名字）不在截取范围内，会自动用正文字体显示

## 数据
- 存在浏览器 IndexedDB（js/vendor/idb-keyval.js）
  - `tamago:data`：主数据（schemaVersion、settings、people、gifts、preferences）
  - `photo:<id>`：压缩后的 JPEG dataURL（最长边 800px，质量 0.7）
- 所有读写只通过 js/store.js
- 人、礼物、偏好是扁平数组，用 personId 关联；删除朋友时连带删除其礼物和照片
- 偏好记录有两种：`type: "prefer"`（我更喜欢这个！）和 `type: "dislike"`（不喜欢）；没有 type 的旧记录当作 prefer
- 示例数据：人和礼物带可选字段 `sample: true`（没有该字段 = 真实数据），用于一键清除；js/sample-data.js 按"今天"推算生日
- 日期用字符串存储（YYYY-MM-DD）；生日为 { year | null, month, day }，year 为空时不显示年龄；2 月 29 日在非闰年按 2 月 28 日提醒
- 修改数据结构：schema.js 中 CURRENT_VERSION +1，并在 migrations 中加迁移函数；不改旧字段含义
- 备份文件：{ app: "tamago", backupVersion, schemaVersion, exportedAt, data, photos }，导出时不含 apiKey
- 导入失败不得覆盖现有数据；覆盖前二次确认
- 启动时调用 navigator.storage.persist()；设置页提示 iPhone 从主屏幕图标打开、定期导出备份

## 安全
- 所有用户输入、AI 返回、导入备份中的内容，在页面上一律作为纯文本显示：用 textContent 或 js/ui/dom.js 的 el()，禁止把这些内容拼进 innerHTML / insertAdjacentHTML / 内联事件属性
- innerHTML 只允许用于代码里写死的静态模板
- 浏览器自带的 `append` / `replaceChildren` 会把 `null` 显示成文字 "null"；可能为空的内容要么放进 `el()`（会自动忽略），要么先 `.filter(Boolean)`

## AI
- 所有 AI 请求只能通过 js/ai.js 的 callAI({ system, prompt, maxTokens, timeoutMs })；其他文件不得直接 fetch AI 接口
- Anthropic Messages API，浏览器直连，需 anthropic-dangerous-direct-browser-access 请求头；默认模型 claude-sonnet-5-5
- API 密钥只存本地 settings.apiKey
- 只发送文字信息，绝不发送照片
- 业务逻辑（提示词、JSON 解析、同品类匹配、灵感清单）放在 js/incubator-logic.js；AI 返回 JSON 格式错误时自动重试一次
- 用结构化输出（output_config.format json_schema）固定 AI 的回答格式
- **AI 不生成任何网址或链接**：购物搜索链接只由 js/shop-platforms.js 的平台模板 + 编码后的关键词拼成（平台列表在这个文件里配置）；关键词里像网址的内容会被丢掉；外链用 target="_blank" rel="noopener noreferrer"。手机上配置了 `appUrl` 的平台（淘宝、小红书）先尝试打开 App（App 地址开头必须在 shop-platforms.js 的白名单里），2 秒后还没离开页面就显示 `mobileFallback`：`web` 给网页版链接，`copy` 提示关键词已复制。App 地址来自社区整理、非官方，可能随 App 更新失效
- 预算 P0 用预设档位：200 以下 / 200–500 / 500–1000 / 1000 以上

## 代码约定
- 每个页面 js/pages/*.js 导出 render(container, params)
- 设计变量集中在 css/tokens.css，不在其他地方写死颜色
- 蛋为统一原创造型（assets/egg.svg），只换颜色；不使用任何原作角色、名称、纹样

## 视觉风格（甜美梦幻 + 天使元素）
- 背景：粉白斜格纹（两组 45° 半透明粉条交叉，形成白 / 浅粉 / 深粉菱形，非常淡；条宽 --gingham-stripe）
- 卡片：白底、2px 粉色虚线边框、大圆角、偏移实色粉影（像贴纸）
- 配色：主色粉（--color-pink-*），点缀 baby blue / 奶黄 / 薄荷 / 薰衣草；文字用暖深色 --color-text
- 装饰两种都用，稀疏点缀、多留白：
  - 手绘线条（带轻微抖动的蜡笔感）：assets/deco/hand-*.svg（闪光星星）
  - 天使翅膀：柔和像素风 assets/deco/pixel-angel-wing.svg（白色羽毛、淡粉紫边缘、无深色描边、根部小卷），显示尺寸用像素图的整数倍；页面标题两侧的小翅膀是 pixel-wing.svg
  - 像素小图标：assets/deco/pixel-*.svg（爱心、星星、天使翅膀），导航图标 assets/nav/*.svg
  - 用法：`<span class="deco deco-heart">`；页面标题 .page-title 两侧自动加像素翅膀；.card-sparkles 给卡片角落加手绘闪光
- 像素图标由 `python3 tools/pixel-icons.py` 从字符画生成；新增图标改脚本里的字符画再运行
- 像素图（PNG + `image-rendering: pixelated`）的位置和尺寸必须是整像素（用 CSS `round(…, 1px)`），它上方元素的高度也要是整数；做动画时把像素图放进一个容器，只对容器做 transform 动画并加 `will-change: transform`（浏览器整体平移画好的图，不逐帧重新取样），这样既平滑又不抖。不要直接对像素图元素做平滑动画（线条会抖，电脑屏幕最明显），也不要用 `steps()`（会卡顿）
- 原创性：design-refs/ 只参考氛围。不得使用原作角色、扑克牌花色加黑色腰带的蛋纹、问号蛋 / X 蛋、锁和钥匙道具，也不得使用三丽鸥等现成角色
- 界面文字以中文为主

## P0 开发顺序
1. 骨架 + 部署 + 中文字体验证
2. 数据层（schema / store / dates / 持久存储）
3. 添加/编辑朋友弹窗（含可选"最近一次送的礼物"，写入礼物墙）+ 目录页
4. 详情页（基础信息 + 标签）
5. 礼物墙 + 添加礼物弹窗（照片压缩）
6. 首页生日倒计时
7. 欢迎页 + 示例数据
8. 设置页（API 密钥、导出/导入备份、数据安全提示）
9. AI 灵感孵化（Plan A/B、同品类提醒、一键登记）
10. 收尾（PRD 异常与边界情况逐条检查、小屏、manifest）

## 工作流程
- 按上面的开发步骤逐步推进，一次只做一个步骤
- 每完成一个步骤：告诉用户怎么测试（本地 / 手机），等用户确认测试通过后再提交一次 Git
- 提交同时在 docs/DEVLOG.md 记录本步遇到的问题，格式：问题 / 原因 / 解决（没有问题也写一行"无"）
