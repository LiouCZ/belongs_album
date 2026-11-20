import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkWatermarks, sitePhotoAssets } from "../scripts/image-watermarks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = process.env.BELONGS_IMAGE_MODULE_DIR ? createRequire(path.join(process.env.BELONGS_IMAGE_MODULE_DIR, "package.json")) : createRequire(import.meta.url);
const sharp = require("sharp");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(await readFile(path.join(root, "data/image-watermarks.json"), "utf8"));
const records = new Map(manifest.assets.map((asset) => [asset.path, asset]));
const assets = await sitePhotoAssets(root);
assert.equal(await checkWatermarks({ site: root }), assets.length);
const counts = { added: 0, existing: 0, backedUp: 0 };
for (const asset of assets) {
  const record = records.get(asset.path);
  const bytes = await readFile(path.join(root, asset.path));
  const meta = await sharp(bytes).metadata();
  assert.deepEqual([meta.width, meta.height], [asset.width, asset.height], `${asset.path}: dimensions must remain unchanged`);
  counts[record.status] += 1;
  if (record.status === "existing") assert.equal(record.sourceSha256, record.publicSha256, "Existing watermarks must retain exact original bytes");
  else {
    assert.notEqual(record.sourceSha256, record.publicSha256);
    if (process.env.BELONGS_WATERMARK_BACKUP) {
      const original = await readFile(path.join(process.env.BELONGS_WATERMARK_BACKUP, asset.path));
      assert.equal(digest(original), record.sourceSha256, `${asset.path}: exact original backup`);
      counts.backedUp += 1;
    }
  }
}
assert.ok(!JSON.stringify(manifest).includes("/Users/"), "Do not publish local backup paths");
console.log(`PASS ${assets.length} referenced photos, dimensions, original existing-watermark bytes and complete public hashes: ${JSON.stringify(counts)}`);
