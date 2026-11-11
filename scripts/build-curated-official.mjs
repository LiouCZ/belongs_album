import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultSite = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function displayDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function sourceFile(source, relative) {
  const file = path.resolve(source, relative);
  if (!file.startsWith(`${source}${path.sep}`)) throw new Error(`Invalid source path: ${relative}`);
  return file;
}

async function copyUploadAsset({ source, site, asset, relative }) {
  if (typeof asset?.path !== "string" || !asset.path.startsWith("assets/uploads/") || asset.path.split(/[\\/]/).includes("..")) {
    throw new Error(`Invalid source path: ${asset?.path}`);
  }
  const input = await realpath(sourceFile(source, asset.path));
  if (!input.startsWith(`${await realpath(source)}${path.sep}`)) throw new Error(`Invalid source path: ${asset.path}`);
  const bytes = await readFile(input);
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`Image hash mismatch: ${asset.path}`);
  if (![asset.width, asset.height].every((value) => Number.isInteger(value) && value > 0)) throw new Error(`Invalid image dimensions: ${asset.path}`);
  const output = path.join(site, relative);
  await mkdir(path.dirname(output), { recursive: true });
  await copyFile(input, output);
}

export async function buildCuratedOfficial({ site = defaultSite, source = path.resolve(defaultSite, "../album_source"), legacy } = {}) {
  legacy ??= JSON.parse(await readFile(path.join(site, "data/items.json"), "utf8"));
  const yearIndexes = new Map();
  let sourceIndex = 0;
  for (const item of legacy.items) {
    yearIndexes.set(item.year, Math.max(yearIndexes.get(item.year) || 0, item.index));
    sourceIndex = Math.max(sourceIndex, item.sourceIndex);
  }

  const articles = [];
  const items = [];
  const workIds = new Set(legacy.items.map((item) => item.workId));
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
      if (entry.releaseType !== undefined && !["regular", "invited"].includes(entry.releaseType)) {
        throw new Error(`Invalid release type: ${entry.id}`);
      }
      if (workIds.has(entry.id)) throw new Error(`Duplicate work ID: ${entry.id}`);
      workIds.add(entry.id);
      const release = entry.releaseType === undefined ? {} : { releaseType: entry.releaseType };
      const images = [];
      for (const [imageIndex, image] of entry.images.entries()) {
        const input = sourceFile(source, image.path);
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
          ...release,
        });
      }
      publicWorks.push({ id: entry.id, title: entry.title, description: entry.description, ...release, images });
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

  const uploads = (await readdir(path.join(source, "entries"))).filter((name) => /^upload-.*\.json$/.test(name)).sort();
  const imageIds = new Set([...legacy.items, ...items].map((item) => item.id));
  for (const name of uploads) {
    const entries = JSON.parse(await readFile(path.join(source, "entries", name), "utf8"));
    if (!Array.isArray(entries) || !entries.length) throw new Error(`Expected an upload entry array: ${name}`);
    for (const entry of entries) {
      if (entry.schemaVersion !== 1 || entry.source?.kind !== "upload" || !/^upload:[a-z0-9][a-z0-9-]*$/.test(entry.id)) throw new Error(`Invalid upload entry: ${entry.id}`);
      if (entry.reviewStatus !== "verified") throw new Error(`Unverified upload: ${entry.id}`);
      if (workIds.has(entry.id)) throw new Error(`Duplicate work ID: ${entry.id}`);
      workIds.add(entry.id);
      if (entry.releaseType !== undefined && !["regular", "invited"].includes(entry.releaseType)) throw new Error(`Invalid release type: ${entry.id}`);
      if (typeof entry.title !== "string" || !entry.title.trim() || typeof entry.description !== "string" || !entry.images?.length) throw new Error(`Incomplete upload: ${entry.id}`);
      const year = entry.year ?? entry.date?.slice(0, 4);
      if (!/^20\d{2}$/.test(year)) throw new Error(`Invalid publication year: ${entry.id}`);
      if (entry.date !== null && (typeof entry.date !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(Date.parse(entry.date)) || new Date(entry.date).toISOString().slice(0, 10) !== entry.date)) throw new Error(`Invalid publication date: ${entry.date}`);
      if (entry.date && entry.date.slice(0, 4) !== year) throw new Error(`Publication year mismatch: ${entry.id}`);
      const date = entry.date === null ? year : displayDate(entry.date);
      for (const [imageIndex, image] of entry.images.entries()) {
        if (typeof image.id !== "string" || !image.id || imageIds.has(image.id)) throw new Error(`Duplicate or invalid upload image ID: ${image.id}`);
        imageIds.add(image.id);
        const directory = `assets/official-uploads/${entry.id.slice(7)}`;
        const relative = `${directory}/${imageIndex + 1}-${path.basename(image.path)}`;
        const thumb = `${directory}/${imageIndex + 1}-thumb-${path.basename(image.thumbnail?.path || "")}`;
        await copyUploadAsset({ source, site, asset: image, relative });
        await copyUploadAsset({ source, site, asset: image.thumbnail, relative: thumb });
        sourceIndex += 1;
        const index = (yearIndexes.get(year) || 0) + 1;
        yearIndexes.set(year, index);
        items.push({
          id: image.id, workId: entry.id, year, date, datePrecision: entry.date === null ? "year" : "day", index, sourceIndex,
          title: entry.title, caption: entry.description, releaseType: entry.releaseType || "regular",
          image: relative, thumb,
          width: image.width, height: image.height, largeWidth: image.width, largeHeight: image.height,
          thumbWidth: image.thumbnail.width, thumbHeight: image.thumbnail.height,
        });
      }
    }
  }

  const payload = { schemaVersion: 1, articles, items };
  const json = JSON.stringify(payload, null, 2);
  await mkdir(path.join(site, "data"), { recursive: true });
  await writeFile(path.join(site, "data/curated-official.json"), `${json}\n`);
  await writeFile(path.join(site, "data/curated-official.js"), `window.BELONGS_CURATED = ${json};\n`);
  console.log(`articles=${articles.length} works=${new Set(items.map((item) => item.workId)).size} images=${items.length}`);
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCuratedOfficial().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
