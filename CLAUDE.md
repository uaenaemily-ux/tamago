# tamago

送礼灵感与生日提醒的个人网页工具。需求见 docs/PRD.md。用户是编程新手：解释要通俗，改动要小步、可在手机上验证。

## 技术约束
- 纯静态：原生 HTML/CSS/JS（ES Modules），无框架、无 npm、无构建、无后端、无数据库
- 部署：GitHub Pages；路由使用 hash（#/home）
- 手机优先，最小宽度 320px 不出现横向滚动
- 本地预览：`python3 -m http.server 8000`，打开 http://localhost:8000
- 当前范围：只做 PRD 中的 P0

## 文件结构
- `index.html`：唯一的 HTML（底部导航 + 页面容器 + 弹窗容器）；`manifest.webmanifest`：添加到主屏幕
- `css/`：tokens.css（设计变量）、base.css、components.css
- `js/main.js` 启动；`router.js` hash 路由；`schema.js` 版本与迁移；`store.js` 数据读写；`dates.js` 日期计算；`photos.js` 照片压缩；`ai.js` 调用 AI；`incubator-logic.js` 孵化业务逻辑；`backup.js` 备份；`sample-data.js` 示例数据
- `js/ui/`：egg、modal、toast、confirm、dom（安全建元素 el()）
- `js/pages/`：welcome、home、directory、detail、incubator、settings
- `js/modals/`：friend-form、gift-form
- `js/vendor/idb-keyval.js`：本地保存的第三方库，不走 CDN
- `fonts/`：QiuYeYuanTi-16.ttf（原字体，只用来截取）、tamago-title.woff2（网页实际加载的截取版）、OFL.txt（授权）
- `tools/subset-font.py`：截取标题字体；`tools/pixel-icons.py`：生成像素图标
- `assets/deco/`：装饰图（手绘 hand-*、像素 pixel-*）；`assets/nav/`：导航图标
- `design-refs/`：美术参考图，已加入 .gitignore，不提交；只参考氛围，所有图案和插画必须原创

## 字体
- 正文：系统字体（苹方，非苹果设备退回微软雅黑 / 思源黑体 / 文泉驿），变量 `--font-body`
- 标题、数字、按钮：Tamago Title（「秋叶圆体 16」截取改名版），变量 `--font-title`；h1/h2/h3、.btn、.num 自动使用
- 点阵字体：字号只用 16 的倍数（16 / 32 / 48px），不加粗
- 授权：SIL OFL 1.1，作者保留名称「秋叶圆体 16」「QiuYeYuanTi 16」，截取版必须用别的名字，保留版权信息和 fonts/OFL.txt
- **新增或修改界面文案后，必须重新截取字体**：
  - 第一次使用（或换电脑）先安装工具：`python3 -m venv .venv && .venv/bin/pip install fonttools brotli`
  - 截取：`.venv/bin/python tools/subset-font.py`（会扫描 index.html 和 js/ 下所有文件，覆盖生成 fonts/tamago-title.woff2）
- 用户输入的文字（如朋友名字）不在截取范围内，会自动用正文字体显示

## 数据
- 存在浏览器 IndexedDB（js/vendor/idb-keyval.js）
  - `tamago:data`：主数据（schemaVersion、settings、people、gifts、preferences）
  - `photo:<id>`：压缩后的 JPEG dataURL（最长边 800px，质量 0.7）
- 所有读写只通过 js/store.js
- 人、礼物、偏好是扁平数组，用 personId 关联；删除朋友时连带删除其礼物和照片
- 日期用字符串存储（YYYY-MM-DD）；生日为 { year | null, month, day }，year 为空时不显示年龄；2 月 29 日在非闰年按 2 月 28 日提醒
- 修改数据结构：schema.js 中 CURRENT_VERSION +1，并在 migrations 中加迁移函数；不改旧字段含义
- 备份文件：{ app: "tamago", backupVersion, schemaVersion, exportedAt, data, photos }，导出时不含 apiKey
- 导入失败不得覆盖现有数据；覆盖前二次确认
- 启动时调用 navigator.storage.persist()；设置页提示 iPhone 从主屏幕图标打开、定期导出备份

## 安全
- 所有用户输入、AI 返回、导入备份中的内容，在页面上一律作为纯文本显示：用 textContent 或 js/ui/dom.js 的 el()，禁止把这些内容拼进 innerHTML / insertAdjacentHTML / 内联事件属性
- innerHTML 只允许用于代码里写死的静态模板

## AI
- 所有 AI 请求只能通过 js/ai.js 的 callAI({ system, prompt, maxTokens, timeoutMs })；其他文件不得直接 fetch AI 接口
- Anthropic Messages API，浏览器直连，需 anthropic-dangerous-direct-browser-access 请求头；默认模型 claude-sonnet-5-5
- API 密钥只存本地 settings.apiKey
- 只发送文字信息，绝不发送照片
- 业务逻辑（提示词、JSON 解析、同品类匹配）放在 js/incubator-logic.js；AI 返回 JSON 格式错误时自动重试一次
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
  - 手绘线条（带轻微抖动的蜡笔感）：assets/deco/hand-*.svg（闪光星星、天使翅膀）
  - 像素小图标：assets/deco/pixel-*.svg（爱心、星星、天使翅膀），导航图标 assets/nav/*.svg
  - 用法：`<span class="deco deco-heart">`；页面标题 .page-title 两侧自动加像素翅膀；.card-sparkles 给卡片角落加手绘闪光
- 像素图标由 `python3 tools/pixel-icons.py` 从字符画生成；新增图标改脚本里的字符画再运行
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
