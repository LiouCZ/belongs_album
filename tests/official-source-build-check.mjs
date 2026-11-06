import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, "../album_source");
const builder = path.join(root, "scripts/build-official-album.mjs");
assert.ok(existsSync(builder), "a canonical JSON-only official album builder must exist");
const temp = mkdtempSync(path.join(os.tmpdir(), "belongs-source-build-"));
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

try {
  const output = path.join(temp, "cold-site");
  const build = () => execFileSync(process.execPath, [builder, "--source", source, "--output", output], { encoding: "utf8" });
  build();
  const migrated = JSON.parse(readFileSync(path.join(output, "data/items.json"), "utf8"));
  const backup = JSON.parse(readFileSync(path.join(source, "backups/legacy-v1/items.json"), "utf8"));
  assert.equal(migrated.items.length, backup.items.length, "every historical image must survive migration");
  assert.deepEqual(migrated.items.map((item) => item.id), backup.items.map((item) => item.id));
  assert.equal(new Set(migrated.items.map((item) => item.id)).size, backup.items.length);
  const oldById = new Map(backup.items.map((item) => [item.id, item]));
  for (const item of migrated.items) {
    const old = oldById.get(item.id);
    for (const field of ["image", "thumb", "sourceIndex", "index", "width", "height", "largeWidth", "largeHeight", "thumbWidth", "thumbHeight"]) {
      assert.equal(item[field], old[field], `${item.id}: preserve ${field}`);
    }
    assert.equal(hash(path.join(output, item.image)), hash(path.join(root, old.image)));
    assert.equal(hash(path.join(output, item.thumb)), hash(path.join(root, old.thumb)));
  }
  const curated = JSON.parse(readFileSync(path.join(output, "data/curated-official.json"), "utf8"));
  assert.deepEqual(curated.articles, JSON.parse(readFileSync(path.join(root, "data/curated-official.json"), "utf8")).articles);
  assert.equal(curated.items.length, 48);
  const context = vm.createContext({ window: {} });
  vm.runInContext(readFileSync(path.join(output, "data/items.js"), "utf8"), context);
  assert.equal(context.window.BELONGS_DATA.items.length, backup.items.length);
  const once = hash(path.join(output, "data/items.json"));
  build();
  assert.equal(hash(path.join(output, "data/items.json")), once, "rebuilding should be deterministic");

  const records = readdirSync(path.join(source, "entries")).filter((file) => file.startsWith("legacy-") && file.endsWith(".json"))
    .flatMap((file) => JSON.parse(readFileSync(path.join(source, "entries", file), "utf8")));
  assert.equal(records.flatMap((entry) => entry.images).length, backup.items.length);
  const wabi = records.find((entry) => entry.title === "侘寂之美");
  assert.equal(wabi.date, "2021-06-06");
  assert.equal(wabi.images.length, 9);
  assert.match(wabi.description, /侘寂和粗制滥造是完全的两极/);
  const feather = records.find((entry) => entry.title === "风中飞扬");
  assert.equal(feather.date, "2022-07-04");
  assert.match(feather.description, /Belongs的首支定款羽毛——初心羽/);
  const flight = records.find((entry) => entry.title === "飞越山海");
  assert.match(flight.description, /1\.初心羽/);
  assert.match(flight.description, /4\.莫比乌斯手镯/);
  assert.match(records.find((entry) => entry.title === "行万里路").description, /6 – 方牌/);
  const newYear = records.find((entry) => entry.title === "你好,2022");
  assert.equal(newYear.date, "2022-01-14");
  assert.equal(newYear.images.length, 9);
  assert.equal(migrated.items.find((item) => item.id === "2021-386-9475e3aae8").year, "2022");
  assert.equal(migrated.items.find((item) => item.id === "2022-094-71900f468f").year, "2023");

  const badSource = path.join(temp, "bad-source");
  mkdirSync(path.join(badSource, "entries"), { recursive: true });
  mkdirSync(path.join(badSource, "articles"));
  const entry = structuredClone(records[0]);
  writeFileSync(path.join(badSource, "legacy-manifest.json"), JSON.stringify({ schemaVersion: 1,
    legacyFiles: ["entries/legacy-2021.json"], requiredImageIds: entry.images.map((image) => image.id) }));
  entry.images[0].path = "../outside.jpg";
  writeFileSync(path.join(badSource, "entries/legacy-2021.json"), JSON.stringify([entry]));
  assert.throws(() => execFileSync(process.execPath, [builder, "--source", badSource, "--output", path.join(temp, "invalid-site")], { stdio: "pipe" }),
    (error) => /Invalid source path/.test(String(error.stderr)), "path traversal should fail explicitly");
  assert.equal(existsSync(path.join(temp, "invalid-site/data/items.json")), false);
  const tampered = structuredClone(records[0]);
  tampered.images = tampered.images.slice(0, 1);
  tampered.source.sourceImageIndexes = [tampered.images[0].sourceImageIndex];
  writeFileSync(path.join(badSource, "legacy-manifest.json"), JSON.stringify({ schemaVersion: 1,
    legacyFiles: ["entries/legacy-2021.json"], requiredImageIds: tampered.images.map((image) => image.id) }));
  for (const asset of [tampered.images[0], tampered.images[0].thumbnail]) {
    const target = path.join(badSource, asset.path);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(source, asset.path), target);
  }
  tampered.images[0].sha256 = "0".repeat(64);
  writeFileSync(path.join(badSource, "entries/legacy-2021.json"), JSON.stringify([tampered]));
  assert.throws(() => execFileSync(process.execPath, [builder, "--source", badSource, "--output", path.join(temp, "tampered-site")], { stdio: "pipe" }),
    (error) => /Image hash mismatch/.test(String(error.stderr)), "corrupted source images must not replace public data");
  assert.equal(existsSync(path.join(temp, "tampered-site/data/items.json")), false);
  const articleFile = readdirSync(path.join(source, "articles")).find((file) => file.endsWith(".json"));
  const article = JSON.parse(readFileSync(path.join(source, "articles", articleFile), "utf8"));
  const work = JSON.parse(readFileSync(path.join(source, "entries", articleFile), "utf8"))[0];
  article.workIds = [work.id];
  for (const image of work.images) {
    const target = path.join(badSource, image.path);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(source, image.path), target);
    image.sha256 = "0".repeat(64);
  }
  tampered.images[0].sha256 = records[0].images[0].sha256;
  writeFileSync(path.join(badSource, "entries/legacy-2021.json"), JSON.stringify([tampered]));
  writeFileSync(path.join(badSource, "articles", articleFile), JSON.stringify(article));
  writeFileSync(path.join(badSource, "entries", articleFile), JSON.stringify([work]));
  const protectedOutput = path.join(temp, "protected-site");
  const oldData = path.join(protectedOutput, "data/items.json");
  const oldImage = path.join(protectedOutput, tampered.images[0].path);
  mkdirSync(path.dirname(oldData), { recursive: true });
  mkdirSync(path.dirname(oldImage), { recursive: true });
  writeFileSync(oldData, "previous public data");
  writeFileSync(oldImage, "previous public image");
  assert.throws(() => execFileSync(process.execPath, [builder, "--source", badSource, "--output", protectedOutput], { stdio: "pipe" }),
    (error) => /Image hash mismatch/.test(String(error.stderr)));
  assert.equal(readFileSync(oldData, "utf8"), "previous public data");
  assert.ok(readFileSync(oldImage).equals(Buffer.from("previous public image")), "failed curated validation must not partially replace historical assets");
  const incompleteManifest = JSON.parse(readFileSync(path.join(badSource, "legacy-manifest.json"), "utf8"));
  incompleteManifest.requiredImageIds.push("required-but-missing-image");
  writeFileSync(path.join(badSource, "legacy-manifest.json"), JSON.stringify(incompleteManifest));
  assert.throws(() => execFileSync(process.execPath, [builder, "--source", badSource, "--output", path.join(temp, "missing-image-site")], { stdio: "pipe" }),
    (error) => /Missing legacy image IDs/.test(String(error.stderr)), "removing a required image inside an existing year must fail");

  const missingSource = path.join(temp, "missing-year-source");
  mkdirSync(path.join(missingSource, "entries"), { recursive: true });
  mkdirSync(path.join(missingSource, "articles"));
  const legacyFiles = readdirSync(path.join(source, "entries")).filter((file) => /^legacy-\d{4}\.json$/.test(file));
  for (const file of legacyFiles.filter((file) => file !== "legacy-2024.json")) {
    copyFileSync(path.join(source, "entries", file), path.join(missingSource, "entries", file));
  }
  writeFileSync(path.join(missingSource, "legacy-manifest.json"), JSON.stringify({ schemaVersion: 1,
    legacyFiles: legacyFiles.map((file) => `entries/${file}`), requiredImageIds: backup.items.map((item) => item.id) }));
  assert.throws(() => execFileSync(process.execPath, [builder, "--source", missingSource, "--output", path.join(temp, "missing-year-site")], { stdio: "pipe" }),
    (error) => /Missing legacy source file/.test(String(error.stderr)), "an incomplete year backup must fail before reading or copying images");
  assert.equal(existsSync(path.join(temp, "missing-year-site/data/items.json")), false);
  console.log(`PASS Word-free cold build, ${migrated.items.length} stable image IDs, exact bytes, complete text, deterministic output, missing-year/image rejection and safe failure`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
