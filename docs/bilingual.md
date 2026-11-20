# 中英文版本维护

## 当前范围

覆盖五个公开页面的公共界面、品类与年份选项、分页、作品详情控件、品牌故事章节及 93 条目录与原文片段、VIP 登记表、定制规则、复制内容和图片导出。

作品内容覆盖 2021–2026 年的 772 组常规发售作品，包括完整文章描述和末尾主题；另有 17 件用户提供照片的官方作品，以及玩家羽翼合集的 30 组作品（39 张图片记录）。空描述保持为空。图片内嵌的中文文字、印戳和品牌字样保持原图，不通过修改图片伪造英文版本。

## 文件

- `i18n.js`：语言状态、文字与属性切换、日期格式及站内链接。
- `i18n.css`：语言下拉框、英文长文字和手机布局适配；不改中文原有配色、图片比例。
- `locales/en/ui.js`：共享导航、筛选、分页、版权和印记等文案。
- `locales/en/works.js`：作品和玩家分享译文、品类标签。
- `locales/en/regular-2021.js` 至 `regular-2026.js`：常规发售逐行审校词典；可精确复用 `story.js` 已核实的相同原文行。
- `scripts/build-english-album.mjs`：检查完整覆盖，生成带原文快照的 `locales/en/regular-works.js`。首页只加载生成结果，不额外加载六份工作词典及故事全文。
- `locales/en/story.js`：品牌故事正文、专题和文章目录译文。
- `locales/en/vip.js`：登记表、状态提示、定制规则译文。

网站加载的词典都是普通本地脚本，不依赖翻译服务、接口或 `fetch` 语言文件，可直接打开 HTML，也适用于 GitHub Pages 与 OSS。

默认中文。页面参数 `lang=en` / `lang=zh` 优先于已保存的 `belongs:language` 偏好。站内链接携带当前语言并保留原查询条件；存储被浏览器禁用时，仍可通过 URL 切换。不会按浏览器语言自动覆盖用户选择。

## 增加或修改译文

原始中文及作品数据继续按现有来源流程维护，不为了翻译修改作品 ID、分组、发布日期、分类、图片顺序或中文字段。

照片作品在 `locales/en/works.js` 按稳定的 `workId` 添加记录；玩家记录用 `id`：

```javascript
works["upload:stable-work-id"] = {
  title: { source: "核实后的中文名称", en: "Reviewed English name" },
  caption: { source: "核实后的完整中文描述", en: "Reviewed English description" },
};
```

`source` 必须与当前数据字段逐字一致，包括换行和标点。源文变化时，旧译文自动失效并回退到中文，应重新核对后同时更新 `source` 和 `en`。没有描述就保留空字符串，不能补写未经确认的故事。若一组多图有多个玩家 ID，应覆盖相应记录，而不是改变它们的分组条件。

完整文章视图使用作品的 `description` 字段，单件视图使用生成后的 `caption`，两者来源不同，不能互相挪用。后续翻译公众号文章时，还须覆盖文章末尾主题，并检查主题只出现一次。

常规发售更新流程：

1. 按来源流程更新中文 canonical 数据并生成官方画册；不要手改 `data/items.js` 等生成文件。
2. 在对应年份的 `regular-YYYY.js` 添加或修改原文行与英文映射。键值按空白归一化精确匹配，不做片段替换；一行对应一行，保留正文的空行、诗句及编号，不为缺失描述编写故事。
3. 运行 `node scripts/build-english-album.mjs`。缺失、空白或仍含中文的译文会使生成失败，不覆盖已有英文产物。生成器同时保存完整原文快照、拆分后的作品名和开头说明，避免把长说明塞进标题。
4. 执行下方覆盖、排版与浏览器检查。`node scripts/build-english-album.mjs --check` 可验证产物是否与当前源文、词典一致。不要直接编辑 `regular-works.js`。

英文排版根据逐行对应的中文结构识别诗、章节和参数区域；普通未知结构采用不丢字的回退。若源文改动导致快照失效，页面保留当前中文，而不是展示过期英文；发布前仍需补全译文并通过覆盖检查。

品牌故事目录按 ID 和字段保存快照；少数跨年重用 ID 的条目用 `字段:年份` 区分。原文片段按整行核实中英映射，保持行序与含义对应。

## 写作与术语

译文按品牌网站的正常表达润色，避免机械逐句直译、空泛拔高和反复解释整理过程。保留原文的事实、意象、情绪与留白，不添加材料、工艺、历史、信仰或承诺。规则类文本优先保真，金额、积分、条件、期限和排除项不得为了简洁而改变。

- 全金：Solid Gold，不等于纯金或 24K。
- 先金：Gold-Tipped，不得标成全金。
- 初心羽：Original Intention Feather。
- 蛇骨链：Serpent-Bone Chain。
- 古董改造：Antique Rework。
- M / L / S 十字：分别为 M / L / S Cross，保留独立筛选值。

部分历史原文含有可疑写法，例如 `S926`、`60mm`、`RETURE`、`天然保石`、`茛召`。本次不借翻译修改中文资料或擅自修正尺寸成色；不明确的石材只写为 natural stone，未确认的 `茛召` 暂保留转写。后续有明确来源时，再同时核对中英文。`匙牌` 按对应作品照片使用 key tag，不误作 spoon tag。

用户填写的姓名、微信号、自由描述不翻译。表单底层名称、选项值和数量限制维持中文，只有展示和生成的登记内容切换语言。

## 检查

```bash
node scripts/build-english-album.mjs --check
node tests/english-build-check.mjs
node tests/regular-english-check.mjs
node tests/reading-english-check.mjs
node tests/reading-layout-check.mjs
node tests/work-i18n-check.mjs
PLAYWRIGHT_MODULE_DIR=/Users/loveling/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node tests/regular-english-browser-check.mjs
PLAYWRIGHT_MODULE_DIR=/Users/loveling/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node tests/i18n-content-layout-check.mjs
PLAYWRIGHT_MODULE_DIR=/Users/loveling/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node tests/i18n-check.mjs
PLAYWRIGHT_MODULE_DIR=/Users/loveling/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node tests/story-i18n-check.mjs
PLAYWRIGHT_MODULE_DIR=/Users/loveling/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node tests/vip-i18n-check.mjs
```

同时检查现有导航、品类、发售板块、分页、玩家分享、品牌故事、详情排版和 VIP 导出。语言切换前后的筛选、页码、搜索、滚动、弹窗、轮播图片和表单值都应保持。确认 1440、390、320 像素下无横向溢出，并检查英文详情与导出截图。

2026-11-19 回归记录：`reading-layout-browser-check.mjs` 在四篇历史中文长文中报告 3–5 像素的文字溢出。用发布前 `HEAD:app.js` 且不加载双语运行时和样式复测，结果一致；本次未修改这些历史排版。相关记录为 `2021-272-22f64a6a79`、`2023-063-36e192ecae`、`2024-063-4219186b53`、`2024-097-9aaa1e7e4b`。
