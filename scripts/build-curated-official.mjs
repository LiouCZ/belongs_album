import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(site, "../album_source");

function displayDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function sourceFile(relative) {
  const file = path.resolve(source, relative);
  if (!file.startsWith(`${source}${path.sep}`)) throw new Error(`Invalid source path: ${relative}`);
  return file;
}

async function build() {
  const legacy = JSON.parse(await readFile(path.join(site, "data/items.json"), "utf8"));
  const yearIndexes = new Map();
  let sourceIndex = 0;
  for (const item of legacy.items) {
    yearIndexes.set(item.year, Math.max(yearIndexes.get(item.year) || 0, item.index));
    sourceIndex = Math.max(sourceIndex, item.sourceIndex);
  }

  const articles = [];
  const items = [];
  const names = (await readdir(path.join(source, "articles"))).filter((name) => name.endsWith(".json")).sort();
  for (const name of names) {
    const article = JSON.parse(await readFile(path.join(source, "articles", name), "utf8"));
    if (article.captureStatus !== "complete") continue;
    if (!article.publishedDate) throw new Error(`Article missing date: ${name}`);
    if (article.theme && article.theme.date !== article.publishedDate) throw new Error(`Theme date mismatch: ${name}`);
    const entries = JSON.parse(await readFile(path.join(source, "entries", name), "utf8"));
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const ordered = article.workIds.map((id, index) => {
      const entry = byId.get(id);
      if (!entry || entry.source.articleId !== article.id || entry.source.position !== index + 1 || entry.reviewStatus !== "verified") {
        throw new Error(`Unverified or unmatched work: ${id}`);
      }
      return entry;
    });
    if (ordered.length !== entries.length) throw new Error(`Unexpected extra works: ${name}`);

    const year = article.publishedDate.slice(0, 4);
    const date = displayDate(article.publishedDate);
    const slug = name.slice(0, -5);
    const publicWorks = [];
    for (const entry of ordered) {
      const images = [];
      for (const [imageIndex, image] of entry.images.entries()) {
        const input = sourceFile(image.path);
        const bytes = await readFile(input);
        const digest = createHash("sha256").update(bytes).digest("hex");
        if (digest !== image.sha256) throw new Error(`Image hash mismatch: ${input}`);
        const relative = `assets/official-articles/${slug}/${entry.source.position}-${imageIndex + 1}-${path.basename(image.path)}`;
        const output = path.join(site, relative);
        await mkdir(path.dirname(output), { recursive: true });
        await copyFile(input, output);
        images.push({ path: relative, width: image.width, height: image.height });

        sourceIndex += 1;
        const index = (yearIndexes.get(year) || 0) + 1;
        yearIndexes.set(year, index);
        items.push({
          id: `${entry.id}:${imageIndex + 1}`,
          year,
          index,
          sourceIndex,
          date,
          title: entry.title,
          caption: [entry.description.trim(), article.theme?.text?.trim()].filter(Boolean).join("\n\n"),
          image: relative,
          thumb: relative,
          width: image.width,
          height: image.height,
          largeWidth: image.width,
          largeHeight: image.height,
          thumbWidth: image.width,
          thumbHeight: image.height,
          articleId: article.id,
          workId: entry.id,
        });
      }
      publicWorks.push({ id: entry.id, title: entry.title, description: entry.description, images });
    }
    articles.push({
      id: article.id,
      date,
      account: article.source.account,
      sourceUrl: article.source.url,
      theme: article.theme ? { date: displayDate(article.theme.date), text: article.theme.text } : null,
      works: publicWorks,
    });
  }

  const payload = { schemaVersion: 1, articles, items };
  const json = JSON.stringify(payload, null, 2);
  await writeFile(path.join(site, "data/curated-official.json"), `${json}\n`);
  await writeFile(path.join(site, "data/curated-official.js"), `window.BELONGS_CURATED = ${json};\n`);
  console.log(`articles=${articles.length} works=${articles.reduce((count, article) => count + article.works.length, 0)} images=${items.length}`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
