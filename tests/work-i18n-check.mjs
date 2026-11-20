import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const window = {};
const context = vm.createContext({ window });
for (const file of ["locales/en/ui.js", "locales/en/works.js", "data/curated-official.js", "data/player-items.js", "album-categories.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
}
const uploads = window.BELONGS_CURATED.items.filter((item) => item.workId?.startsWith("upload:"));
const items = [...uploads, ...window.BELONGS_DATA.items];
for (const item of items) {
  const id = item.workId || item.id;
  for (const field of ["title", "caption"]) {
    const entry = window.BELONGS_EN.works[id]?.[field];
    assert.equal(entry?.source, item[field], `${id}.${field}: exact source snapshot`);
    assert.equal(typeof entry.en, "string");
    assert.equal(/[\u3400-\u9fff]/u.test(entry.en), false, `${id}.${field}: English copy`);
    if (!item[field]) assert.equal(entry.en, "", "never invent a missing description");
  }
  for (const category of window.BELONGS_CATEGORIES.forGroup(item)) {
    assert.ok(window.BELONGS_EN.text[category], `${category}: translated category label`);
  }
}
assert.equal(new Set(uploads.map((item) => item.workId)).size, 17);
assert.equal(window.BELONGS_DATA.items.length, 39);
assert.equal(Object.keys(window.BELONGS_EN.works).length, 56);
assert.equal(window.BELONGS_EN.text["M十字"], "M Cross");
assert.equal(window.BELONGS_EN.text["L十字"], "L Cross");
assert.equal(window.BELONGS_EN.text["S十字"], "S Cross");
assert.match(window.BELONGS_EN.works["upload:2026-xianjin-wing"].title.en, /Gold-Tipped/);
assert.doesNotMatch(window.BELONGS_EN.works["upload:2026-xianjin-wing"].title.en, /Solid Gold/);
assert.match(window.BELONGS_EN.works["upload:2026-custom-gold-wing-ring"].title.en, /Solid Gold/);
console.log("PASS exact-source translations: 17 supplied-photo works, 39 player images / 30 groups, empty captions and separate categories");
