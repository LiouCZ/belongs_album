import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = promisify(execFile);
const manifestPath = "data/image-watermarks.json";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exists = (file) => stat(file).then(() => true, () => false);
const approvedPath = (value) => typeof value === "string" && /^assets\/(?:images|thumbs|official-articles|official-uploads|player-images|player-thumbs)\/.+\.(?:jpe?g|png|webp)$/i.test(value)
  && !value.split(/[\\/]/).some((part) => part === ".." || part === ".") && !value.includes("\\");

function checkPath(value) {
  if (!approvedPath(value)) throw new Error(`Invalid photo path: ${value}`);
  return value;
}

export function photoAssets(items) {
  const assets = new Map();
  for (const item of items) {
    const master = checkPath(item.image);
    for (const [role, relative, width, height] of [["image", item.image, item.largeWidth, item.largeHeight], ["thumb", item.thumb, item.thumbWidth, item.thumbHeight]]) {
      if (!relative) continue;
      checkPath(relative);
      if (!assets.has(relative)) assets.set(relative, { path: relative, role, master, width, height });
    }
  }
  return [...assets.values()];
}

export async function sitePhotoAssets(site = root) {
  const items = [];
  for (const file of ["data/items.js", "data/curated-official.js", "data/player-items.js"]) {
    if (!await exists(path.join(site, file))) continue;
    const window = {};
    vm.runInNewContext(await readFile(path.join(site, file), "utf8"), { window }, { filename: file });
    items.push(...(window.BELONGS_CURATED || window.BELONGS_DATA).items);
  }
  return photoAssets(items);
}

export function classifyWatermark(lines) {
  const recognizable = lines.filter((line) => line.confidence >= 0.15).map((line) => line.text);
  for (const text of recognizable) {
    const clean = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replaceAll("0", "O").replaceAll("1", "I").replace(/[^A-Z&]/g, "");
    if (/BELONGS(?:OFF[IL]C[IL]A[IL]|B&?K)/.test(clean)) return { status: "existing", detected: text };
  }
  const uncertain = recognizable.find((text) => /BEL[O0]NG/i.test(text));
  return uncertain ? { status: "review", detected: uncertain } : { status: "add" };
}

export function watermarkSvg(width, height, bounds = { left: 0, top: 0, width, height }) {
  if (![width, height, bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isInteger) || width < 1 || height < 1
    || bounds.left < 0 || bounds.top < 0 || bounds.width < 1 || bounds.height < 1
    || bounds.left + bounds.width > width || bounds.top + bounds.height > height) throw new Error("Invalid watermark bounds");
  const font = Math.min(Math.max(9, Math.round(Math.min(bounds.width, bounds.height) * 0.03)), bounds.width / 10, bounds.height / 4);
  const margin = Math.max(3, Math.round(Math.min(bounds.width, bounds.height) * 0.025));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${bounds.left + bounds.width - margin}" y="${bounds.top + bounds.height - margin}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${font}" font-weight="600" letter-spacing="${font * 0.04}" fill="#ffffff" fill-opacity="0.86" stroke="#111111" stroke-opacity="0.48" stroke-width="${font * 0.08}" stroke-linejoin="round" paint-order="stroke">BELONGS B&amp;K</text></svg>`;
}

async function readManifest(file) {
  return await exists(file) ? JSON.parse(await readFile(file, "utf8")) : { schemaVersion: 1, text: "BELONGS B&K", assets: [] };
}

function validatePlan(plan, final = false) {
  if (plan.schemaVersion !== 1 || plan.text !== "BELONGS B&K" || !Array.isArray(plan.assets)) throw new Error("Invalid watermark manifest");
  const paths = new Set();
  for (const asset of plan.assets) {
    checkPath(asset.path);
    if (paths.has(asset.path)) throw new Error(`Duplicate watermark path: ${asset.path}`);
    paths.add(asset.path);
    if (asset.status === "review") throw new Error(`Resolve watermark review: ${asset.path}`);
    if (!(final ? ["added", "existing"] : ["add", "added", "existing"]).includes(asset.status)
      || !/^[a-f0-9]{64}$/.test(asset.sourceSha256)
      || (final && !/^[a-f0-9]{64}$/.test(asset.publicSha256))) throw new Error(`Invalid watermark record: ${asset.path}`);
  }
}

function imageLibrary() {
  const require = createRequire(import.meta.url);
  try { return require("sharp"); } catch (error) {
    if (!process.env.BELONGS_IMAGE_MODULE_DIR) throw new Error("Sharp is required; set BELONGS_IMAGE_MODULE_DIR to the installed image-library directory", { cause: error });
    return createRequire(path.join(process.env.BELONGS_IMAGE_MODULE_DIR, "package.json"))("sharp");
  }
}

export async function checkWatermarks({ site = root } = {}) {
  const manifest = await readManifest(path.join(site, manifestPath));
  validatePlan(manifest, true);
  const records = new Map(manifest.assets.map((asset) => [asset.path, asset]));
  const assets = await sitePhotoAssets(site);
  for (const asset of assets) {
    const record = records.get(asset.path);
    if (!record || hash(await readFile(path.join(site, asset.path))) !== record.publicSha256) {
      throw new Error(`Unreviewed or changed photo: ${asset.path}; audit and apply before publishing`);
    }
  }
  return assets.length;
}

export async function applyWatermarkPlan({ site = root, backup, plan } = {}) {
  site = await realpath(site);
  if (!backup || path.resolve(backup) === site || path.resolve(backup).startsWith(`${site}${path.sep}`)) throw new Error("Backup must be outside the public site");
  await mkdir(backup, { recursive: true });
  backup = await realpath(backup);
  if (backup === site || backup.startsWith(`${site}${path.sep}`)) throw new Error("Backup must be outside the public site");
  validatePlan(plan);
  const allowed = new Set((await sitePhotoAssets(site)).map((asset) => asset.path));
  const previous = await readManifest(path.join(site, manifestPath));
  const records = new Map(previous.assets.map((asset) => [asset.path, asset]));
  const pending = [];
  // Validate every audit before writing any public image.
  for (const asset of plan.assets) {
    if (!allowed.has(asset.path)) throw new Error(`Photo is not referenced by the album: ${asset.path}`);
    const file = await realpath(path.join(site, asset.path));
    if (!file.startsWith(`${site}${path.sep}`)) throw new Error(`Photo is outside the public site: ${asset.path}`);
    const bytes = await readFile(file);
    const digest = hash(bytes);
    if (["added", "existing"].includes(asset.status) && asset.publicSha256 === digest) {
      records.set(asset.path, asset);
    } else if (digest !== asset.sourceSha256 || asset.status === "added") {
      throw new Error(`Photo changed since audit: ${asset.path}`);
    } else if (asset.status === "existing") {
      records.set(asset.path, { ...asset, publicSha256: digest });
    } else {
      const original = path.join(backup, asset.path);
      if (await exists(original) && hash(await readFile(original)) !== digest) throw new Error(`Backup differs: ${asset.path}`);
      pending.push({ asset, bytes, file, original });
    }
  }
  const temp = await mkdtemp(path.join(path.dirname(site), ".watermark-stage-"));
  try {
    const sharp = pending.length ? imageLibrary() : null;
    for (const [index, entry] of pending.entries()) {
      const meta = await sharp(entry.bytes).metadata();
      if (meta.orientation && meta.orientation !== 1) throw new Error(`Review image orientation before watermarking: ${entry.asset.path}`);
      if (meta.width !== entry.asset.width || meta.height !== entry.asset.height) throw new Error(`Image dimensions changed: ${entry.asset.path}`);
      let pipeline = sharp(entry.bytes).composite([{ input: Buffer.from(watermarkSvg(meta.width, meta.height, entry.asset.watermarkBounds)) }]);
      if (meta.format === "jpeg") pipeline = pipeline.jpeg({ quality: 97, chromaSubsampling: "4:4:4" });
      else if (meta.format === "png") pipeline = pipeline.png();
      else if (meta.format === "webp") pipeline = pipeline.webp({ lossless: true });
      else throw new Error(`Unsupported photo format: ${entry.asset.path}`);
      const output = await pipeline.toBuffer();
      entry.staged = path.join(temp, String(index));
      await writeFile(entry.staged, output);
      records.set(entry.asset.path, { ...entry.asset, status: "added", publicSha256: hash(output) });
    }
    for (const entry of pending) {
      await mkdir(path.dirname(entry.original), { recursive: true });
      if (!await exists(entry.original)) await writeFile(entry.original, entry.bytes, { flag: "wx" });
    }
    // Recheck after rendering, so a concurrent edit cannot be silently overwritten.
    for (const entry of pending) {
      if (hash(await readFile(entry.file)) !== entry.asset.sourceSha256) throw new Error(`Photo changed during watermarking: ${entry.asset.path}`);
    }
    for (const entry of pending) await rename(entry.staged, entry.file);
    const manifest = { schemaVersion: 1, text: "BELONGS B&K", assets: [...records.values()].filter((asset) => allowed.has(asset.path)) };
    const stagedManifest = path.join(temp, "manifest.json");
    await writeFile(stagedManifest, `${JSON.stringify(manifest, null, 2)}\n`);
    await mkdir(path.join(site, "data"), { recursive: true });
    await rename(stagedManifest, path.join(site, manifestPath));
    return pending.length;
  } finally { await rm(temp, { recursive: true, force: true }); }
}

export async function preserveReviewedWatermarks({ site, published = root } = {}) {
  const manifest = await readManifest(path.join(published, manifestPath));
  if (!manifest.assets.length) return 0;
  validatePlan(manifest, true);
  const assets = new Map((await sitePhotoAssets(site)).map((asset) => [asset.path, asset]));
  const kept = [];
  const copies = [];
  for (const record of manifest.assets) {
    if (!assets.has(record.path)) { kept.push(record); continue; }
    const digest = hash(await readFile(path.join(site, record.path)));
    if (digest === record.publicSha256) { kept.push(record); continue; }
    if (digest !== record.sourceSha256) {
      console.warn(`Photo changed; watermark review required before publishing: ${record.path}`);
      continue;
    }
    const bytes = await readFile(path.join(published, record.path));
    if (hash(bytes) !== record.publicSha256) throw new Error(`Reviewed public photo changed: ${record.path}`);
    copies.push({ record, bytes });
    kept.push(record);
  }
  for (const { record, bytes } of copies) await writeFile(path.join(site, record.path), bytes);
  await mkdir(path.join(site, "data"), { recursive: true });
  await writeFile(path.join(site, manifestPath), `${JSON.stringify({ ...manifest, assets: kept }, null, 2)}\n`);
  return copies.length;
}

export async function auditWatermarks({ site = root, output } = {}) {
  if (!output) throw new Error("An external audit output path is required");
  const assets = await sitePhotoAssets(site);
  const previous = new Map((await readManifest(path.join(site, manifestPath))).assets.map((asset) => [asset.path, asset]));
  const records = new Map();
  for (const asset of assets) {
    const digest = hash(await readFile(path.join(site, asset.path)));
    const old = previous.get(asset.path);
    records.set(asset.path, old?.publicSha256 === digest ? { ...asset, ...old } : { ...asset, sourceSha256: digest });
  }
  const inputs = assets.filter((asset) => !records.get(asset.path).status && (asset.path === asset.master
    || Math.abs(asset.width / asset.height - records.get(asset.master).width / records.get(asset.master).height) > 0.02))
    .map((asset) => ({ path: asset.path, file: path.join(site, asset.path) }));
  if (inputs.length && process.platform !== "darwin") throw new Error("The local watermark audit uses macOS Vision; audit on a Mac before applying the reviewed manifest.");
  const temp = await mkdtemp(path.join(os.tmpdir(), "belongs-watermark-audit-"));
  try {
    if (inputs.length) {
      const binary = path.join(temp, "audit-watermarks");
      await run("swiftc", [path.join(root, "scripts/audit-watermarks.swift"), "-o", binary], { maxBuffer: 4 * 1024 * 1024 });
      for (let offset = 0; offset < inputs.length; offset += 60) {
        const inputFile = path.join(temp, "inputs.json");
        await writeFile(inputFile, JSON.stringify(inputs.slice(offset, offset + 60)));
        const { stdout } = await run(binary, [inputFile], { maxBuffer: 16 * 1024 * 1024 });
        for (const row of stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))) {
          if (row.error) throw new Error(`${row.path}: ${row.error}`);
          Object.assign(records.get(row.path), classifyWatermark(row.lines));
        }
        console.log(`Audited ${Math.min(offset + 60, inputs.length)}/${inputs.length} source photos`);
      }
    }
    for (const asset of assets) {
      const record = records.get(asset.path);
      if (record.status) continue;
      const master = records.get(asset.master);
      if (!master?.status) throw new Error(`Missing master audit: ${asset.path}`);
      Object.assign(record, { status: master.status, ...(master.detected ? { detected: master.detected } : {}) });
    }
    const manifest = { schemaVersion: 1, text: "BELONGS B&K", assets: [...records.values()] };
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ assets: assets.length, counts: manifest.assets.reduce((counts, asset) => ({ ...counts, [asset.status]: (counts[asset.status] || 0) + 1 }), {}), output }));
    return manifest;
  } finally { await rm(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, argument] = process.argv.slice(2);
  if (mode === "--audit") {
    auditWatermarks({ output: argument }).catch((error) => { console.error(error); process.exitCode = 1; });
  } else if (mode === "--apply") {
    const backup = process.argv[4];
    readFile(argument, "utf8").then((json) => applyWatermarkPlan({ plan: JSON.parse(json), backup }))
      .then((count) => console.log(`Added watermarks to ${count} photos`)).catch((error) => { console.error(error); process.exitCode = 1; });
  } else if (mode === "--check") {
    checkWatermarks().then((count) => console.log(`PASS ${count} reviewed public photos`)).catch((error) => { console.error(error); process.exitCode = 1; });
  } else {
    console.error("Usage: node scripts/image-watermarks.mjs --audit <external-audit.json> | --apply <reviewed-audit.json> <external-backup-directory> | --check");
    process.exitCode = 1;
  }
}
