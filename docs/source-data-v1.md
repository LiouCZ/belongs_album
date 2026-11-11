# 公众号图文数据格式 v1

## 保存什么

每篇公众号文章拆成两类记录：

- **文章记录**：只保存来源链接、公众号名称、发布日期、用于裁切的作品原图、作品 ID 列表，以及文章末尾的**主题描述**。主题描述独立放在 `theme: {date, text}`，不重复塞进每件作品的说明。文章标题仅作来源标识，不能当成作品标题。
- **作品记录**：一件作品一条，保存日期、作品名称、作品说明和对应的截图。多张图属于同件作品时放在同一 `images` 数组中。每张截图保留原长图 ID、像素裁切坐标、尺寸和 SHA-256，便于核对图文关系。原始作品说明不重复存文章主题；生成官网单件图文时，在描述末尾空一行附上主题，整篇视图只在文章末尾显示一次。

发售规则、二维码、购买方式、售罄通知、联系方式、版权声明不进入作品说明或主题描述。作品自身的设计元素、搭配、规格、材质属于作品说明，可保留。末尾文字需逐行核对：本篇主题记录为“——被温暖环绕——”，而不是前一句“前路漫漫亦灿灿，作品既是艺术亦是态度。”或品牌署名；没有明确主题时用 `null`，不补写。

Schema：`schemas/wechat-article.v1.schema.json`、`schemas/album-entry.v1.schema.json`。`captureStatus: "complete"` 表示**目标内容**（作品截图、对应说明和末尾主题）已核齐，不表示保存了发售全文；对应不清的作品标记 `needs_review`，缺失目标内容的文章标记 `partial`。历史记录也使用作品 Schema，`source.kind: "docx"` 仅标记最初出处，不代表生成时还需要读取 Word。

## 统一维护入口

正式源数据在网站仓库旁的 `/Users/loveling/Belongs/album_source/`：

```text
album_source/
  articles/<公众号文章 ID>.json
  entries/<公众号文章 ID>.json
  entries/legacy-2021.json ... legacy-2026.json
  entries/upload-<作品标识>.json  直接提供照片的作品
  assets/uploads/<作品标识>/    原图及独立缩略图
  assets/2026/...             公众号原图及截图
  assets/images/2021/...      历史画册大图，保留旧图片 ID
  assets/thumbs/2021/...      历史画册缩略图
  backups/legacy-v1/          迁移前的 items.json / items.js
  migrations/legacy-v1.json   日期、分组及文字变动清单
  legacy-manifest.json       必须保留的年份文件及旧图片 ID 清单
```

**以后只编辑这里的 JSON 和图片，不编辑生成的 `data/items.*` / `data/curated-official.*`，也不再运行 `.album_build/build_web_album.py`。** 所有历史图片、缩略图都已独立保存；重建不需要原 Word、迁移前的导出或旧网页数据。`backups/` 是可追溯备份，不是构建输入。

在网站目录运行统一命令：

```bash
cd /Users/loveling/Belongs/belongs_album
node scripts/build-official-album.mjs
```

该命令读取按年历史作品和已校对的公众号作品，检查完整清单、图片哈希与顺序，再生成两个现有浏览器载荷及对应图片。任一年源文件或历史必需图片缺失时中止，先在临时目录完成全部生成和校验，再替换公开文件。网页仍兼容直接双击打开，历史内容不会与公众号新记录重复导入。`--source <源目录> --output <输出目录>` 可用于恢复到空目录或验证备份；输出目录与源目录必须分开。`legacy-manifest.json` 是正式源数据，应与 JSON 和图片一起备份；只有明确新增年份或经用户确认调整必需 ID 时才修改清单，普通文案更新不用改动它。

若修改了品牌故事引用的历史正文，随后运行 `node scripts/build-story-catalog.mjs` 更新故事摘录；同一作品的多个图片 ID 只摘录一次。历史图片 ID、图片路径和原始序号保留，不能随意改名。

网站目录只包含发布产物。**备份时同时保留整个 `album_source/` 和网站仓库**；只推送 GitHub Pages 不会备份站外源记录。源目录中的原文快照、审核备注和迁移清单不复制进公开站点。

旧 Word、PDF 画册和压缩包保留在网站仓库之外，不随 Pages 发布。仓库 `.gitignore` 已排除这些文件及 Office 临时文件，避免后续误加入；它们不是网站运行或重建所需的文件，不必复制到网站目录。

## 常规发售与邀约作品

官方画册在同一页面内分为「常规发售」与「邀约作品」，默认展示常规发售。两栏各自按发布日期升序排列，使用相同的网格 / 目录、搜索、品类、年份和分页。切换栏目回到第一页，保留关键词与仍然有效的筛选；没有内容的栏目显示未收录状态。`index.html?release=invited` 可直达邀约作品，与 `view=list`、`q` 参数兼容。整篇图文仍展示完整原文中的作品，不按栏目截断。

在 `album_source/entries/` 中对应的**作品记录顶层**添加可选字段：

```json
"releaseType": "invited"
```

- `regular`：常规发售。
- `invited`：邀约作品。
- 省略该字段：兼容旧记录，按常规发售展示；现有内容无需批量改写。

每件作品独立设置，同一篇文章可以同时包含两类作品；历史记录也支持显式设置。该字段与品类、固定 / 非固定等制作类型以及作品元素相互独立，不能凭标题、材质、定制或正文关键词自动推断。根据用户确认或明确原文分类，无法确认时先核对，不擅自把作品归入邀约栏目。新建记录建议明确填写归属。

更新后运行同一条 `node scripts/build-official-album.mjs`，无需另建页面或手动编辑网站载荷。构建会将显式归属传到每张图片和整篇作品数据，拒绝非法字段值，原图片 ID、路径和图文关系保持不变。

### 直接提供照片的作品

没有公众号链接时，使用 `entries/upload-<作品标识>.json` 数组，每件作品一条；`source: {"kind": "upload"}`，不编造公众号或 Word 来源。作品 ID 使用 `upload:<英文小写或数字连字符标识>`。沿用同一作品 Schema，把多张图按展示顺序放进 `images`，保留稳定图片 ID、原图路径、哈希、实际尺寸，以及独立 `thumbnail` 的路径、哈希和尺寸。图片统一保存在 `assets/uploads/`；原图按字节保留，只缩小缩略图，不随意裁切或改色。确认后标记 `verified`，内部 `reviewNotes` 记录事实与描述来源，不公开到网页。

仅展示作品名称与照片时，填写 `description: ""`，卡片和详情隐藏描述区，不补「无文字说明」；已确认但不公开的资料可留在内部审核备注中。

仅知道年份时，填写 `date: null, year: "2026"`，不补 1 月 1 日或录入日期。网页显示「2026 年」，年份筛选照常生效；按年归档在同年明确日期的作品之后，不借用相邻作品的日期。知道完整日期时填写真实 `date`，如同时有 `year` 则二者必须一致。没有文章主题就不添加主题；材质、品类和邀约归属只用已确认信息。

统一构建会读取这些记录，生成独立的 `assets/official-uploads/` 图片并写入现有 `curated-official.*` 载荷；无需另建文章记录或修改历史清单。记录校验、重建与备份仍走上述统一流程。首件实录为 `upload-2026-xianjin-wing.json`：先金羽翼，2026 年，18K 金＋配方银，两张正反面照片。

## 历史画册迁移结果

2026-11-04 已完成一次性迁移：原画册的 1011 张图片及缩略图全部保留，生成 718 组历史图文，并与现有公众号文章记录共存。以 Word 中的 213 个明确日期段落核对时间，修复跨年归属、同行日期标题、图片后下一件标题，以及《侘寂之美》《马》《信使》《你好,2022》的已知叙事拆段。另保留 19 组图片之后、下一日期之前的说明，包括《飞越山海》的四件作品、《行万里路》的六件作品和腰带定制尺寸等，正文不会在换日期或文末被丢弃。原导出完整文字在 `backups/legacy-v1/` 中逐字保留，变动逐图片记录在迁移清单。

历史记录保留 `needs_review`：自动核对日期和图片身份，不等于逐件人工确认作品名称与图像。19 组仍无正文，保持空字符串；不凭空补写原文、链接或末尾主题。旧合集有整篇叙事和多件作品合图，按现有可确认的对应关系存储，不假装已拆成独立作品。

历史作品字段与公众号作品一致：`id`、`source`、`date`、`title`、`description`、`images`、`reviewStatus`。历史来源增加以下兼容信息：

- `year`：年份；`date` 无法确认时设为 `null`，仍可按年份检索。本次真实数据的日期均已找到明确出处。
- `source.articleTitle`、`source.paragraphIndexes`：原 Word 中的文章标题与段落位置，仅供追溯；不是伪造的公众号文章 ID。
- `images[].thumbnail`：缩略图路径、哈希和实际尺寸。
- `images[].legacy`：旧年内序号与原始尺寸；`sourceImageIndex` 保留全局图片顺序。

这里的历史“大图”是原网站已导出的图片版本，并非声称恢复了 Word 内的原始分辨率。所有大图和缩略图按字节复制，未重新压缩、裁切或改变色彩。已校对的公众号记录仍须有非空作品说明；历史缺失内容与用户要求仅展示名称的直接上传作品允许空说明。

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
5. 运行 `node scripts/build-official-album.mjs`，从统一源目录重建历史数据与公众号新图文。单件详情在描述末尾空一行附主题，整篇只读视图在最后显示一次；没有主题时只展示作品说明。准确发布日期参与全站升序排列，同篇作品保留原文顺序。生成数据保持独立载荷，避免重复加载；不再重新解析 Word。

校验命令：

```bash
cd /Users/loveling/Belongs/belongs_album
python3 tests/source-data-schema-check.py \
  /Users/loveling/Belongs/album_source/articles/afUnYP9DPfBYOcFBT6-XCg.json \
  /Users/loveling/Belongs/album_source/entries/afUnYP9DPfBYOcFBT6-XCg.json
```

全量校验：

```bash
python3 tests/source-data-schema-check.py \
  ../album_source/articles/*.json ../album_source/entries/*.json
node tests/official-source-build-check.mjs
```

校验器使用 Python 的 `jsonschema` 和 `Pillow`。路径使用相对数据根目录的路径，不在记录里写本机绝对路径、Cookie 或访问令牌。`scripts/migrate-legacy-source.py` 仅供审计这次迁移；目标已有历史记录时会拒绝覆盖，日常维护使用 JSON 和统一构建命令。
