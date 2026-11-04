import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "reading-layout.js");
assert.ok(existsSync(file), "shared, lossless reading layout must exist");
const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(file, "utf8"), context);
const reading = context.window.BelongsReading;
const plain = (html) => html.replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");

const legacy = JSON.parse(readFileSync(path.join(root, "data/items.json"))).items;
const curated = JSON.parse(readFileSync(path.join(root, "data/curated-official.json")));
const groups = new Map(legacy.map((item) => [item.workId, item]));
for (const item of groups.values()) {
  const title = reading.title(item.title);
  assert.equal(title.heading + title.description, item.title, `${item.id}: title split must be lossless`);
  const result = reading.format(item.caption, { id: item.workId });
  assert.equal(plain(result.html), item.caption, `${item.id}: every caption character and line break must survive`);
}
for (const article of curated.articles) {
  for (const work of article.works) {
    const caption = `${work.description.trim()}\n\n${article.theme.text}`;
    const result = reading.format(caption, { theme: article.theme.text, trustedSpecs: true });
    assert.equal(plain(result.html), caption);
    assert.equal((result.html.match(/class="detail-spec-row/g) || []).length, 5);
    assert.equal((result.html.match(/class="detail-specs reading-specs"/g) || []).length, 1);
    assert.match(result.html, /<dt data-label="制作类型：" aria-label="制作类型"><\/dt>/);
    assert.match(result.html, /<dt data-label="元素：" aria-label="元素"><\/dt>/);
    assert.equal((result.html.match(/class="detail-theme/g) || []).length, 1);
  }
}

const longTitle = legacy.find((item) => item.id === "2023-043-7327f96269").title;
assert.equal(reading.title(longTitle).heading, "2.狗牌");
assert.match(reading.title(longTitle).description, /梦想与现实/);
for (const title of ["2.14", "莫比乌斯镯（L码）", "3.戒指（港码20）", "未闭合（括号", "2026，你好"]) {
  assert.equal(reading.title(title).heading, title, "unknown headings and size variants must not be split");
}
const flight = groups.get("legacy:2023-035-d5db39d114");
assert.equal((reading.format(flight.caption).html.match(/class="reading-item"/g) || []).length, 4);
const journey = groups.get("legacy:2022-067-310f0b46de");
assert.equal((reading.format(journey.caption, { id: journey.workId }).html.match(/reading-paragraph reading-note/g) || []).length, 3,
  "special prose paragraph grouping must not merge subsequent note lines");
const specs = reading.format("正面雕刻。\n*搭配：圆珠2\n*规格：港码20\n*材质：配方S925、Au750");
assert.equal((specs.html.match(/class="detail-spec-row/g) || []).length, 3);
const motifWork = curated.articles.flatMap((article) => article.works).find((work) => work.id === "wechat:zAgTUUI6DRLU7rFtnm-LSg:07");
assert.match(reading.format(motifWork.description).html, /<dd>金月金符节 飞羽蛇 金眼<\/dd>/);
const multilineWork = curated.articles.flatMap((article) => article.works).find((work) => work.id === "wechat:zAgTUUI6DRLU7rFtnm-LSg:04");
assert.match(reading.format(multilineWork.description).html, /<dd>金符节 唐草 飞耳马与唐草\n金眼与鎏金<\/dd>/);
for (const type of ["固定品类", "已固定造型独立雕刻", "非固定造型 独立雕刻", "不固定造型独立雕刻", "固定造型独立錾刻", "非固定造型雕刻", "随机造型独立雕刻", "宽度厚度近似、独立制作雕刻", "即兴"]) {
  const raw = `羽毛造型吊坠\n${type}\n金符节 飞羽蛇 金眼\n*搭配：无\n*规格：标准\n*材质：配方S925 Au750`;
  const result = reading.format(raw);
  assert.equal(plain(result.html), raw);
  assert.equal((result.html.match(/class="detail-spec-row/g) || []).length, 5, type);
  const unstarred = reading.format(raw.replaceAll("*", ""));
  assert.equal((unstarred.html.match(/class="detail-specs reading-specs"/g) || []).length, 1,
    "verified bare fields stay with their matching specifications even without star prefixes");
}
for (const raw of ["固定品类\n这是一段创作时的感受。\n搭配：无\n规格：标准\n材质：配方S925", "金月金符节 飞羽蛇 金眼", "固定品类\n金眼\n这次的故事还未写完。", "独立雕刻与我，都是日常。\n金眼\n搭配：无\n规格：标准\n材质：配方S925"]) {
  const result = reading.format(raw);
  assert.equal(plain(result.html), raw);
  assert.doesNotMatch(result.html, /data-label=/, "narrative and incomplete structures must not acquire inferred labels");
}
const inlineType = groups.get("legacy:2026-017-9f1a80038b");
const inlineLayout = reading.format(inlineType.caption, { id: inlineType.workId }).html;
assert.match(inlineLayout, /<dd>已固定造型独立雕刻<\/dd>/);
assert.match(inlineLayout, /<dd>鹰首 符节 反战 羽翼<\/dd>/);
assert.doesNotMatch(reading.format(inlineType.caption.replace("羽翼", "羽毛"), { id: inlineType.workId }).html, /data-label=/,
  "changed special anchors must fall back instead of guessing an inline boundary");
for (const id of ["legacy:2026-070-3846e976f6", "legacy:2026-071-d5a8fb7bd6", "legacy:2026-073-891185d29f"]) {
  const item = groups.get(id);
  const result = reading.format(item.caption, { id });
  assert.match(result.html, /data-label="元素："/);
  assert.doesNotMatch(result.html, /data-label="制作类型："/, "version names and prose are not manufacturing types");
  assert.equal(plain(result.html), item.caption);
}
assert.doesNotMatch(reading.format("18K黄金，手工打制。\n0.3cm珠链。\n2026.10.23").html, /reading-item"/);
assert.doesNotMatch(reading.format("材质：这是旧文中的一句话。\n——不是已确认主题——").html, /detail-specs|detail-theme/);
assert.doesNotMatch(reading.format("这是正文中的本期内容，并非标题。").html, /reading-heading/);
const horse = groups.get("legacy:2023-013-361b50f596");
assert.match(reading.format(horse.caption, { id: horse.workId }).html, /reading-verse/);
assert.equal(reading.format(horse.caption, { id: horse.workId }).long, true);
const autumn = groups.get("legacy:2021-225-3d46972a33");
assert.equal((reading.format(autumn.caption, { id: autumn.workId }).html.match(/reading-heading/g) || []).length, 5);
const unsafe = '<img src=x onerror="alert(1)">\n\n& text <script>alert(1)</script>';
assert.equal(plain(reading.format(unsafe).html), unsafe);
assert.doesNotMatch(reading.format(unsafe).html, /<img|<script/);
const openTitle = groups.get("legacy:2024-026-a976d3e338");
const split = reading.title(openTitle.title, { id: openTitle.workId, caption: openTitle.caption });
assert.equal(split.heading, "2.大十字套装", "verified cross-field parentheses need a dedicated title boundary");
assert.equal(split.heading + split.description, openTitle.title);
const continued = groups.get("legacy:2026-061-f39b5c1582");
const continuedLayout = reading.format(continued.caption, { id: continued.workId }).html;
assert.match(continuedLayout, /鎏金葡萄叶&amp;鎏金茛苕.花、\n六一字样、金沙漏。<\/dd>/);
assert.equal((continuedLayout.match(/class="detail-spec-row/g) || []).length, 4);
assert.match(reading.format(groups.get("legacy:2023-008-8d9e14725b").caption, { id: "legacy:2023-008-8d9e14725b" }).html, /reading-verse/);
for (const [id, anchors] of Object.entries(reading.anchors)) {
  const item = groups.get(`legacy:${id}`);
  assert.ok(item, `special layout must use an existing stable work ID: ${id}`);
  for (const anchor of anchors) assert.ok(item.caption.split(/\r?\n/).includes(anchor), `${id}: stale layout anchor ${anchor}`);
}
console.log(`PASS lossless formatting of ${groups.size} historical works, 42 curated works, numbering, specifications, safe fallback and special layouts`);
