import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applyWatermarkPlan, auditWatermarks, checkWatermarks, preserveReviewedWatermarks } from "../scripts/image-watermarks.mjs";

const require = process.env.BELONGS_IMAGE_MODULE_DIR ? createRequire(path.join(process.env.BELONGS_IMAGE_MODULE_DIR, "package.json")) : createRequire(import.meta.url);
const sharp = require("sharp");
const temp = await mkdtemp(path.join(os.tmpdir(), "belongs-watermark-test-"));
const site = path.join(temp, "site");
const backup = path.join(temp, "backup");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
try {
  const original = await sharp({ create: { width: 480, height: 320, channels: 3, background: "#42605a" } }).jpeg().toBuffer();
  await mkdir(path.join(site, "assets/images"), { recursive: true });
  await mkdir(path.join(site, "data"), { recursive: true });
  const assets = ["assets/images/add.jpg", "assets/images/existing.jpg"].map((relative, index) => ({ path: relative, master: relative, role: "image", width: 480, height: 320,
    status: index ? "existing" : "add", sourceSha256: digest(original) }));
  for (const asset of assets) await writeFile(path.join(site, asset.path), original);
  await writeFile(path.join(site, "data/items.js"), `window.BELONGS_DATA=${JSON.stringify({ items: assets.map((asset) => ({ image: asset.path, largeWidth: 480, largeHeight: 320 })) })}`);
  const plan = { schemaVersion: 1, text: "BELONGS B&K", assets };
  const changed = await applyWatermarkPlan({ site, backup, plan });
  assert.equal(changed, 1);
  const watermarked = await readFile(path.join(site, assets[0].path));
  assert.notEqual(digest(watermarked), digest(original));
  const meta = await sharp(watermarked).metadata();
  assert.deepEqual([meta.width, meta.height], [480, 320]);
  assert.deepEqual(await readFile(path.join(backup, assets[0].path)), original, "Exact backup stays outside the public site");
  assert.deepEqual(await readFile(path.join(site, assets[1].path)), original, "Existing watermarks must not be recompressed");
  const manifest = JSON.parse(await readFile(path.join(site, "data/image-watermarks.json"), "utf8"));
  assert.equal(await checkWatermarks({ site }), 2);
  assert.equal(await applyWatermarkPlan({ site, backup, plan: manifest }), 0, "Repeated runs cannot double-watermark");
  assert.deepEqual(await readFile(path.join(site, assets[0].path)), watermarked);

  // A fresh thumbnail comes from canonical bytes, not the already-watermarked public master.
  const thumb = "assets/thumbs/new.jpg";
  const thumbBytes = await sharp(original).resize(240, 160).jpeg().toBuffer();
  const dataBefore = await readFile(path.join(site, "data/items.js"));
  await mkdir(path.join(site, "assets/thumbs"), { recursive: true });
  await writeFile(path.join(site, thumb), thumbBytes);
  await writeFile(path.join(site, "data/items.js"), `window.BELONGS_DATA=${JSON.stringify({ items: [
    { image: assets[0].path, largeWidth: 480, largeHeight: 320, thumb, thumbWidth: 240, thumbHeight: 160 },
    { image: assets[1].path, largeWidth: 480, largeHeight: 320 },
  ] })}`);
  const audit = await auditWatermarks({ site, output: path.join(temp, "audit.json") });
  assert.equal(audit.assets.find((asset) => asset.path === thumb).status, "add", "new thumbnail must not inherit master's final added state");
  assert.equal(await applyWatermarkPlan({ site, backup, plan: audit }), 1);
  assert.equal(await checkWatermarks({ site }), 3);
  const reviewed = JSON.parse(await readFile(path.join(site, "data/image-watermarks.json"), "utf8"));
  assert.equal(await applyWatermarkPlan({ site, backup, plan: reviewed }), 0);
  await writeFile(path.join(site, "data/items.js"), dataBefore);
  await writeFile(path.join(site, "data/image-watermarks.json"), JSON.stringify(manifest));

  const cold = path.join(temp, "cold");
  await mkdir(path.join(cold, "assets/images"), { recursive: true });
  await mkdir(path.join(cold, "data"), { recursive: true });
  await writeFile(path.join(cold, "data/items.js"), await readFile(path.join(site, "data/items.js")));
  for (const asset of assets) await writeFile(path.join(cold, asset.path), original);
  await preserveReviewedWatermarks({ site: cold, published: site });
  assert.deepEqual(await readFile(path.join(cold, assets[0].path)), watermarked, "Cold official build preserves the reviewed public version");
  assert.deepEqual(await readFile(path.join(cold, assets[1].path)), original);
  await writeFile(path.join(cold, assets[0].path), Buffer.from("new source photo"));
  await preserveReviewedWatermarks({ site: cold, published: site });
  await assert.rejects(() => checkWatermarks({ site: cold }), /Unreviewed/);
  assert.equal((await readFile(path.join(cold, assets[0].path), "utf8")), "new source photo", "Changed sources must not inherit a stale watermark decision");
  await writeFile(path.join(cold, assets[0].path), original);
  await writeFile(path.join(site, assets[0].path), Buffer.from("damaged public cache"));
  await assert.rejects(() => preserveReviewedWatermarks({ site: cold, published: site }), /public photo changed/);
  assert.deepEqual(await readFile(path.join(cold, assets[0].path)), original, "A corrupt public cache must not overwrite clean source bytes");
  await writeFile(path.join(site, assets[0].path), watermarked);
  await assert.rejects(() => applyWatermarkPlan({ site, backup: path.join(site, "backup"), plan: manifest }), /outside/);
  await assert.rejects(() => applyWatermarkPlan({ site, backup, plan: { ...plan, assets: [{ ...assets[0], status: "review" }] } }), /review/i);
  const before = await readFile(path.join(site, assets[1].path));
  await assert.rejects(() => applyWatermarkPlan({ site, backup, plan: { ...plan, assets: [{ ...assets[1], sourceSha256: "0".repeat(64) }] } }), /changed/i);
  assert.deepEqual(await readFile(path.join(site, assets[1].path)), before, "Stale audit cannot overwrite changed files");
  console.log("PASS exact backups, existing bytes, stable dimensions, no double watermark, cold build, changed-source gate and stale/unsafe/corrupt-cache rejection");
} finally { await rm(temp, { recursive: true, force: true }); }
