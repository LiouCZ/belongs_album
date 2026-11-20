import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const window = {};
const context = vm.createContext({ window });
for (const file of ["data/items.js", "data/curated-official.js", "reading-layout.js", "locales/en/ui.js", "locales/en/works.js", "locales/en/regular-works.js"]) {
  const filename = path.join(root, file);
  if (fs.existsSync(filename)) vm.runInContext(fs.readFileSync(filename, "utf8"), context);
}
const regular = [...window.BELONGS_DATA.items, ...window.BELONGS_CURATED.items]
  .filter((item) => !item.releaseType || item.releaseType === "regular");
const missing = [];
const ids = new Set();
const numbers = (value) => [...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) => match[0]).sort().join("|");
const materialMarks = (value) => [...value.matchAll(/(?:Au\d+|S\d+|\d+[Kk])/g)].map((match) => match[0].toLowerCase()).sort().join("|");
for (const item of regular) {
  const id = item.workId || item.id;
  ids.add(id);
  const fields = window.BELONGS_EN.works[id];
  const display = window.BelongsReading.title(item.title, { id, caption: item.caption });
  for (const [field, source] of Object.entries({ title: item.title, caption: item.caption, heading: display.heading, lead: display.description })) {
    const entry = fields?.[field];
    if (entry?.source !== source || typeof entry.en !== "string") { missing.push(`${id}.${field}`); continue; }
    assert.equal(/[\u3400-\u9fff]/u.test(entry.en), false, `${id}.${field}: no untranslated Chinese`);
    if (!source) assert.equal(entry.en, "", `${id}.${field}: no invented text`);
    assert.equal(entry.en.split(/\r\n|\n|\r/).length, source.split(/\r\n|\n|\r/).length, `${id}.${field}: retain line breaks`);
    if (field === "caption") {
      const englishLines = entry.en.split(/\r\n|\n|\r/);
      for (const [index, line] of source.split(/\r\n|\n|\r/).entries()) {
        if (!/^[ *＊]*(?:搭配|规格|材质|尺寸|尺码|参考重量|重量|长度|宽度|直径)[：:]/.test(line)) continue;
        assert.equal(numbers(englishLines[index]), numbers(line), `${id}: specification numbers preserved`);
        assert.equal(materialMarks(englishLines[index]), materialMarks(line), `${id}: alloy and karat marks preserved`);
      }
    }
  }
  if (fields?.lead && fields?.caption) {
    const source = [display.description, item.caption].filter(Boolean).join("\n\n");
    const en = [fields.lead.en, fields.caption.en].filter(Boolean).join("\n\n");
    const rows = (layout) => (layout.html.match(/class="detail-spec-row"/g) || []).length;
    assert.equal(rows(window.BelongsReading.format(en, { id, language: "en", source })),
      rows(window.BelongsReading.format(source, { id })), `${id}: preserve source parameter hierarchy`);
  }
}
assert.equal(ids.size, 772);
assert.equal(missing.length, 0, `Every regular field needs a source-checked translation (${missing.length} missing): ${missing.slice(0, 12).join(", ")}`);
assert.match(window.BELONGS_EN.works["legacy:2024-178-eafc6110dc"].title.en, /a gold feather surrounded by three scrolling vines/i);
for (const item of regular.filter((item) => item.title.includes("方钻"))) {
  assert.match(window.BELONGS_EN.works[item.workId || item.id].title.en, /diamond-form/i, "A diamond-shaped design is not a diamond setting");
}
assert.match(window.BELONGS_EN.works["legacy:2026-033-5efb31874d"].caption.en, /Square Diamond-Form Ring/, "The same design name is accurate inside a multi-work caption");
assert.doesNotMatch(window.BELONGS_EN.works["legacy:2025-152-a09932e4a3"].caption.en, /curtain/i, "The photographed chain is not a bead curtain");
for (const article of window.BELONGS_CURATED.articles) {
  for (const work of article.works) {
    for (const field of ["title", "description"]) {
      const entry = window.BELONGS_EN.works[work.id]?.[field];
      assert.equal(entry?.source, work[field], `${work.id}.${field}: full article source`);
      assert.doesNotMatch(entry.en, /[\u3400-\u9fff]/u);
    }
  }
  if (article.theme) {
    const entry = window.BELONGS_EN.articles?.[article.id]?.theme;
    assert.equal(entry?.source, article.theme.text, `${article.id}: closing theme source`);
    assert.doesNotMatch(entry.en, /[\u3400-\u9fff]/u);
    for (const work of article.works) {
      const caption = window.BELONGS_EN.works[work.id].caption.en;
      assert.ok(caption.endsWith(`\n\n${entry.en}`), `${work.id}: theme retained at the end`);
      assert.equal(caption.split(entry.en).length - 1, 1, `${work.id}: one theme only`);
    }
  }
}
console.log(`PASS complete English coverage: ${ids.size} regular works, all full-article fields, closing themes, exact sources and blank captions`);
