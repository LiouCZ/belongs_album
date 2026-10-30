# 公众号图文数据格式 v1

## 保存什么

每篇公众号文章拆成两类记录：

- **文章记录**：只保存来源链接、公众号名称、发布日期、用于裁切的作品原图、作品 ID 列表，以及文章末尾的**主题描述**。主题描述独立放在 `theme: {date, text}`，不重复塞进每件作品的说明。文章标题仅作来源标识，不能当成作品标题。
- **作品记录**：一件作品一条，保存日期、作品名称、作品说明和对应的截图。多张图属于同件作品时放在同一 `images` 数组中。每张截图保留原长图 ID、像素裁切坐标、尺寸和 SHA-256，便于核对图文关系。原始作品说明不重复存文章主题；生成官网单件图文时，在描述末尾空一行附上主题，整篇视图只在文章末尾显示一次。

发售规则、二维码、购买方式、售罄通知、联系方式、版权声明不进入作品说明或主题描述。作品自身的设计元素、搭配、规格、材质属于作品说明，可保留。末尾文字需逐行核对：本篇主题记录为“——被温暖环绕——”，而不是前一句“前路漫漫亦灿灿，作品既是艺术亦是态度。”或品牌署名；没有明确主题时用 `null`，不补写。

Schema：`schemas/wechat-article.v1.schema.json`、`schemas/album-entry.v1.schema.json`。`captureStatus: "complete"` 表示**目标内容**（作品截图、对应说明和末尾主题）已核齐，不表示保存了发售全文；对应不清的作品标记 `needs_review`，缺失目标内容的文章标记 `partial`。

## 本篇实录

文章：`/Users/loveling/Belongs/album_source/articles/afUnYP9DPfBYOcFBT6-XCg.json`

七件作品：`/Users/loveling/Belongs/album_source/entries/afUnYP9DPfBYOcFBT6-XCg.json`

截图和原长图：`/Users/loveling/Belongs/album_source/assets/2026/2026-10-23/`

本篇原图第 2 张是一张 1080×5022 的七件作品长图；按原图顺序裁成七张 1080×630 的截图，与原文 ❶–❼ 逐一匹配。原图第 1 张是发售入口图，不保存。末尾主题句“——被温暖环绕——”单独记录日期 `2026-10-23`。

## 后续抓取流程

1. 打开文章，核对发布时间、作品说明、作品图顺序和末尾主题句。验证码或不可访问时记录 `partial`，不猜测缺失内容。
2. 保存作品原图；对多件作品长图按分隔区裁切。逐图目视核对作品形态与说明，保留相同画幅并避开水印、分隔线；不要对银色、氧化和镀金做会改变材质观感的滤镜。
3. 每件作品建立一条作品记录，截图与对应描述成组保存；附上原图 ID、裁切坐标和文件哈希。规则、二维码及其他发售文案在提取阶段丢弃。
4. 末尾主题句单独记录在文章 `theme`，明确日期。校验文章和作品记录、文件哈希、尺寸、裁切范围及顺序后再标记 `complete` / `verified`。
5. 正式数据保存在网站仓库外的 `/Users/loveling/Belongs/album_source/`。运行 `node scripts/build-curated-official.mjs` 将已校对文章导出为独立的 `data/curated-official.json` / `.js` 与 `assets/official-articles/` 图片；官方首页会在旧画册数据之外加载这些作品。有主题时，单件详情的图文描述末尾附主题，整篇只读视图在最后显示一次；没有主题时只展示作品说明。旧 Word 的 1011 张图仍保留 `docx` 来源；导出脚本不会覆盖 `data/items.json` / `.js`。站外原始数据需另行备份，它不会随 GitHub Pages 发布。

校验命令：

```bash
cd /Users/loveling/Belongs/belongs_album
python3 tests/source-data-schema-check.py \
  /Users/loveling/Belongs/album_source/articles/afUnYP9DPfBYOcFBT6-XCg.json \
  /Users/loveling/Belongs/album_source/entries/afUnYP9DPfBYOcFBT6-XCg.json
```

校验器使用本机 `jsonschema` 和 `ffprobe`。路径使用相对数据根目录的路径，不在记录里写本机绝对路径、Cookie 或访问令牌。
