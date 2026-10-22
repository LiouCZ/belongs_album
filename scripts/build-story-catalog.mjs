import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventory = readFileSync(path.join(root, "docs/brand-story-article-inventory.md"), "utf8");
const items = JSON.parse(readFileSync(path.join(root, "data/items.json"), "utf8")).items;
const itemById = new Map(items.map((item) => [item.id, item]));
const counts = { "2021": 0, "2022": 0, "2023": 0, "2024—2026": 0 };
const stories = [];
let section = "";

function plain(value) {
  return value.replaceAll("`", "").trim();
}

function sourceItems(ids, cell) {
  if (!cell.includes("至") || ids.length !== 2) return ids.map((id) => itemById.get(id));
  const first = items.findIndex((item) => item.id === ids[0]);
  const last = items.findIndex((item) => item.id === ids[1]);
  if (first < 0 || last < first) throw new Error(`Invalid item range: ${cell}`);
  return items.slice(first, last + 1);
}

for (const line of inventory.split("\n")) {
  if (line.startsWith("## ")) {
    section = line.match(/^## (202[123]) 年/)?.[1]
      ?? (line.startsWith("## 2024—2026 年") ? "2024—2026" : "");
  }
  if (!section || !line.startsWith("| ") || line.startsWith("| ---")) continue;
  const cells = line.slice(2, -2).split(" | ");
  if (["主题", "层级", "可串联主题"].includes(cells[0])) continue;

  const laterWorks = section === "2024—2026";
  const origin = cells[laterWorks ? 0 : 1];
  const idCell = cells[laterWorks ? 1 : 2];
  const ids = [...idCell.matchAll(/`(202[1-6]-\d{3}-[a-f0-9]{10})`/g)].map((match) => match[1]);
  if (!ids.length || ids.some((id) => !itemById.has(id))) throw new Error(`Unknown story item: ${idCell}`);

  const date = laterWorks ? "" : origin.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
  if (!laterWorks && !date) throw new Error(`Missing publication date: ${origin}`);
  const originalTitle = laterWorks ? "" : origin.match(/《([^》]+)》/)?.[1] ?? "";
  const title = originalTitle || plain(cells[0]);
  const summary = plain(cells[laterWorks ? 2 : section === "2023" ? 3 : 4]);
  const quote = laterWorks ? "" : plain(cells[section === "2023" ? 4 : 5]).replace(/^“|”$/g, "");
  const matches = sourceItems(ids, idCell);
  const sourceText = matches.map((item) => [item.title, item.caption].join(" ")).join(" ").replace(/\s+/g, "");
  if (quote && !sourceText.includes(quote.replace(/\s+/g, ""))) {
    throw new Error(`Quote not found in source items: ${ids[0]} / ${quote}`);
  }
  const item = itemById.get(ids[0]);
  if (!existsSync(path.join(root, item.image))) throw new Error(`Missing story image: ${item.image}`);

  stories.push({
    key: `${section}-${ids[0]}`,
    id: ids[0],
    sourceIds: ids,
    year: date ? date.slice(0, 4) : section,
    date,
    title,
    hasOriginalTitle: Boolean(originalTitle),
    topic: laterWorks ? title : section === "2023" ? "" : plain(cells[0]),
    kind: laterWorks ? "作品线索" : section === "2023" ? plain(cells[0]) : "文章素材",
    summary,
    quote,
    image: item.image,
    thumb: item.thumb,
    sourceSections: matches.flatMap((source, index) => {
      if (source.id === ids[0] && source.title === originalTitle && !source.caption) return [];
      const includeTitle = source.title !== originalTitle;
      return [{
        label: `${source.date || source.year}${matches.length > 1 ? ` · 片段 ${index + 1}` : ""}`,
        text: [includeTitle ? source.title : "", source.caption].filter(Boolean).join("\n"),
      }];
    }),
  });
  counts[section] += 1;
}

for (const [year, expected] of Object.entries({ "2021": 19, "2022": 49, "2023": 18, "2024—2026": 7 })) {
  if (counts[year] !== expected) throw new Error(`Expected ${expected} ${year} stories, found ${counts[year]}`);
}

const output = `window.BELONGS_STORIES = ${JSON.stringify(stories, null, 2)};\n`;
writeFileSync(path.join(root, "data/story-catalog.js"), output);
console.log(`Generated ${stories.length} stories from the verified inventory.`);
