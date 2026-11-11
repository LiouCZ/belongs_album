import { createHash } from "node:crypto";
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildCuratedOfficial } from "./build-curated-official.mjs";

const defaultSite = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function displayDate(value, year) {
  if (value === null) return year;
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid publication date: ${value}`);
  }
  const [y, month, day] = value.split("-").map(Number);
  if (String(y) !== year) throw new Error(`Publication year mismatch: ${value} / ${year}`);
  return `${y}年${month}月${day}日`;
}

async function checkedAsset(source, asset, prefix) {
  const relative = asset?.path;
  if (typeof relative !== "string" || path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..") || !relative.startsWith(prefix)) {
    throw new Error(`Invalid source path: ${relative}`);
  }
  const file = await realpath(path.resolve(source, relative));
  if (!file.startsWith(`${await realpath(source)}${path.sep}`)) throw new Error(`Invalid source path: ${relative}`);
  const bytes = await readFile(file);
  if (!/^[a-f0-9]{64}$/.test(asset.sha256) || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
    throw new Error(`Image hash mismatch: ${relative}`);
  }
  if (![asset.width, asset.height].every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error(`Invalid image dimensions: ${relative}`);
  }
  return { file, relative };
}

export async function buildOfficialAlbum({ site = defaultSite, source = path.resolve(defaultSite, "../album_source") } = {}) {
  source = path.resolve(source);
  site = path.resolve(site);
  if (source === site || source.startsWith(`${site}${path.sep}`) || site.startsWith(`${source}${path.sep}`)) {
    throw new Error("Source and public output must be separate directories");
  }
  const manifest = JSON.parse(await readFile(path.join(source, "legacy-manifest.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.legacyFiles) || !manifest.legacyFiles.length
    || manifest.legacyFiles.some((name) => !/^entries\/legacy-\d{4}\.json$/.test(name))
    || new Set(manifest.legacyFiles).size !== manifest.legacyFiles.length
    || !Array.isArray(manifest.requiredImageIds) || !manifest.requiredImageIds.length
    || manifest.requiredImageIds.some((id) => typeof id !== "string" || !id)
    || new Set(manifest.requiredImageIds).size !== manifest.requiredImageIds.length) {
    throw new Error("Invalid canonical legacy manifest");
  }
  const files = manifest.legacyFiles.map((name) => path.basename(name)).sort();
  const available = (await readdir(path.join(source, "entries"))).filter((name) => /^legacy-\d{4}\.json$/.test(name));
  for (const file of files) {
    if (!available.includes(file)) throw new Error(`Missing legacy source file: ${file}`);
  }
  if (available.some((file) => !files.includes(file))) throw new Error("Unlisted legacy source file: update legacy-manifest.json");
  const items = [];
  const assets = new Map();
  const entryIds = new Set();
  const imageIds = new Set();
  const imageIndexes = new Set();
  let entryCount = 0;
  for (const file of files) {
    const entries = JSON.parse(await readFile(path.join(source, "entries", file), "utf8"));
    if (!Array.isArray(entries)) throw new Error(`Expected an entry array: ${file}`);
    for (const entry of entries) {
      if (entry.schemaVersion !== 1 || entry.source?.kind !== "docx" || entryIds.has(entry.id)) {
        throw new Error(`Invalid or duplicate legacy entry: ${entry.id}`);
      }
      entryIds.add(entry.id);
      entryCount += 1;
      if (entry.releaseType !== undefined && !["regular", "invited"].includes(entry.releaseType)) {
        throw new Error(`Invalid release type: ${entry.id}`);
      }
      const year = entry.year ?? entry.date?.slice(0, 4);
      if (!/^20\d{2}$/.test(year) || typeof entry.title !== "string" || !entry.title.trim() || typeof entry.description !== "string") {
        throw new Error(`Incomplete legacy entry: ${entry.id}`);
      }
      const date = displayDate(entry.date, year);
      if (!entry.images?.length || JSON.stringify(entry.source.sourceImageIndexes) !== JSON.stringify(entry.images.map((image) => image.sourceImageIndex))) {
        throw new Error(`Legacy image order mismatch: ${entry.id}`);
      }
      for (const image of entry.images) {
        const sourceIndex = image.sourceImageIndex;
        if (imageIds.has(image.id) || imageIndexes.has(sourceIndex) || !Number.isInteger(sourceIndex) || sourceIndex < 1) {
          throw new Error(`Duplicate or invalid legacy image: ${image.id}`);
        }
        imageIds.add(image.id);
        imageIndexes.add(sourceIndex);
        const metadata = image.legacy;
        if (!metadata || ![metadata.index, metadata.originalWidth, metadata.originalHeight].every((value) => Number.isInteger(value) && value > 0)) {
          throw new Error(`Missing stable legacy image metadata: ${image.id}`);
        }
        for (const [asset, prefix] of [[image, "assets/images/"], [image.thumbnail, "assets/thumbs/"]]) {
          const checked = await checkedAsset(source, asset, prefix);
          if (assets.has(checked.relative)) throw new Error(`Repeated public asset path: ${checked.relative}`);
          assets.set(checked.relative, checked);
        }
        items.push({
          id: image.id, year, index: metadata.index, sourceIndex, date,
          title: entry.title, caption: entry.description,
          image: image.path, thumb: image.thumbnail.path,
          width: metadata.originalWidth, height: metadata.originalHeight,
          largeWidth: image.width, largeHeight: image.height,
          thumbWidth: image.thumbnail.width, thumbHeight: image.thumbnail.height,
          workId: entry.id,
          ...(entry.releaseType === undefined ? {} : { releaseType: entry.releaseType }),
        });
      }
    }
  }
  const missingIds = manifest.requiredImageIds.filter((id) => !imageIds.has(id));
  if (missingIds.length) throw new Error(`Missing legacy image IDs: ${missingIds.slice(0, 5).join(", ")}`);
  items.sort((a, b) => a.sourceIndex - b.sourceIndex);
  const payload = {
    schemaVersion: 1, source: "album_source/legacy-manifest.json", count: items.length,
    years: [...new Set(items.map((item) => item.year))].sort(), items,
  };
  // Stage both sources together so failed WeChat validation cannot replace legacy images.
  const staging = await mkdtemp(path.join(os.tmpdir(), "belongs-official-build-"));
  try {
    for (const { file, relative } of assets.values()) {
      const output = path.resolve(staging, relative);
      await mkdir(path.dirname(output), { recursive: true });
      await copyFile(file, output);
    }
    await buildCuratedOfficial({ site: staging, source, legacy: payload });
    const json = JSON.stringify(payload, null, 2);
    await writeFile(path.join(staging, "data/items.json"), `${json}\n`);
    await writeFile(path.join(staging, "data/items.js"), `window.BELONGS_DATA = ${json};\n`);
    await cp(staging, site, { recursive: true });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  console.log(`legacy entries=${entryCount} images=${items.length}; source=JSON; Word not used`);
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { source: { type: "string" }, output: { type: "string" } } });
  buildOfficialAlbum({ source: values.source, site: values.output }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
