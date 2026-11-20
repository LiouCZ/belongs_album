import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const window = {};
vm.runInNewContext(fs.readFileSync(new URL("../reading-layout.js", import.meta.url), "utf8"), { window });
const source = "初心羽吊坠\n固定造型独立雕刻\n金沙漏 蛇骨\n搭配：无\n规格：M\n材质：配方S925 Au750\n\n——被温暖环绕——";
const text = "Original Intention Feather pendant\nEstablished form, individually carved\nGold hourglass, serpent bone\nPairing: none\nSpecifications: M\nMaterials: formulated S925 Au750\n\n——Surrounded by warmth——";
const result = window.BelongsReading.format(text, { language: "en", source, theme: "——Surrounded by warmth——", trustedSpecs: true });
assert.match(result.html, /data-label="Making:"/);
assert.match(result.html, /data-label="Elements:"/);
assert.equal((result.html.match(/class="detail-spec-row"/g) || []).length, 5);
assert.match(result.html, /class="detail-theme reading-theme"/);
assert.equal(result.html.replace(/<[^>]*>/g, ""), text);
assert.doesNotMatch(result.html, /[\u3400-\u9fff]/u);

const verseSource = "银饰\n于我是纸笔，\n记录脑海里每一格即视的画面，\n记载生命中每一寸饱满的光阴。\n前路迢迢万里，把心交托于你。\n说明：\n*请依次发送编号。";
const verse = "Silverwork\nis my pen and paper,\nholding each passing image,\neach moment of a life fully lived.\nA long road ahead. I entrust my heart to you.\nNotes:\n*Send the numbers in order.";
const poem = window.BelongsReading.format(verse, { id: "legacy:2023-002-733543a278", language: "en", source: verseSource });
assert.match(poem.html, /reading-verse/);
assert.match(poem.html, /reading-heading reading-note/);
assert.equal(poem.html.replace(/<[^>]*>/g, ""), verse);

const fallback = window.BelongsReading.format(source, { language: "en", source, theme: "——被温暖环绕——", trustedSpecs: true });
assert.equal((fallback.html.match(/class="detail-spec-row"/g) || []).length, 5, "Source fallback retains Chinese specifications");
assert.equal(fallback.html.replace(/<[^>]*>/g, ""), source);
for (const file of ["data/items.js", "locales/en/regular-works.js"]) {
  vm.runInNewContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { window });
}
for (const [id, expected] of [["2025-025-ebf55ef989", 2], ["2025-053-1b13a0d8c2", 3], ["2026-017-9f1a80038b", 5]]) {
  const item = window.BELONGS_DATA.items.find((item) => item.id === id);
  const entry = window.BELONGS_EN.works[`legacy:${id}`].caption;
  const layout = window.BelongsReading.format(entry.en, { id, language: "en", source: item.caption });
  assert.equal((layout.html.match(/class="detail-spec-row"/g) || []).length, expected, `${id}: English retains explicit source fields and inline making/elements`);
  assert.equal(layout.html.replace(/<[^>]*>/g, ""), entry.en);
}
console.log("PASS English typography: source-aligned making/elements, metadata rows, closing themes and original verse structure");
