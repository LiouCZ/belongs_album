import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOfficialAlbum } from "../scripts/build-official-album.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonical = path.resolve(root, "../album_source");
const temp = await mkdtemp(path.join(os.tmpdir(), "belongs-upload-build-"));
const source = path.join(temp, "source");
const site = path.join(temp, "site");
const save = (relative, value) => writeFile(path.join(source, relative), JSON.stringify(value));
try {
  await mkdir(path.join(source, "entries"), { recursive: true });
  await mkdir(path.join(source, "articles"));
  const legacy = JSON.parse(await readFile(path.join(canonical, "entries/legacy-2021.json"), "utf8")).slice(0, 1);
  const originals = legacy[0].images.slice(0, 1);
  for (const image of originals) {
    for (const asset of [image, image.thumbnail]) {
      const target = path.join(source, asset.path);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(canonical, asset.path), target);
    }
  }
  await save("legacy-manifest.json", { schemaVersion: 1, legacyFiles: ["entries/legacy-2021.json"], requiredImageIds: legacy.flatMap((entry) => entry.images.map((image) => image.id)) });
  await save("entries/legacy-2021.json", legacy);
  const images = [];
  for (let i = 0; i < 2; i += 1) {
    const original = originals[0];
    const image = { id: `uploaded-${i + 1}`, path: `assets/uploads/wing/${i + 1}.jpg`, sha256: original.sha256, width: original.width, height: original.height,
      thumbnail: { ...original.thumbnail, path: `assets/uploads/wing/${i + 1}-thumb.jpg` } };
    for (const [asset, from] of [[image, original], [image.thumbnail, original.thumbnail]]) {
      await mkdir(path.dirname(path.join(source, asset.path)), { recursive: true });
      await cp(path.join(canonical, from.path), path.join(source, asset.path));
    }
    images.push(image);
  }
  const entry = { schemaVersion: 1, id: "upload:wing-2026", source: { kind: "upload" }, date: null, year: "2026",
    releaseType: "invited", title: "先金羽翼", description: "金色落在翼尖。\n\n材质：18K金＋配方银", images, reviewStatus: "verified" };
  await save("entries/upload-wing-2026.json", [entry]);
  await buildOfficialAlbum({ source, site });
  const payloadPath = path.join(site, "data/curated-official.json");
  const payload = JSON.parse(await readFile(payloadPath, "utf8"));
  assert.equal(payload.articles.length, 0, "direct photos must not invent a WeChat source");
  assert.equal(payload.items.length, 2, "both uploaded photos must enter the official album");
  assert.equal(new Set(payload.items.map((item) => item.workId)).size, 1);
  assert.deepEqual(payload.items.map((item) => item.date), ["2026", "2026"]);
  assert.ok(payload.items.every((item) => item.datePrecision === "year" && item.year === "2026" && item.releaseType === "invited"));
  assert.ok(payload.items.every((item) => item.caption === entry.description && !item.articleId));
  for (const [index, item] of payload.items.entries()) {
    assert.ok((await readFile(path.join(site, item.image))).equals(await readFile(path.join(source, images[index].path))));
    assert.ok((await readFile(path.join(site, item.thumb))).equals(await readFile(path.join(source, images[index].thumbnail.path))));
    assert.notEqual(item.image, item.thumb, "thumbnails must not duplicate full-size downloads");
  }
  const previous = await readFile(payloadPath, "utf8");
  await buildOfficialAlbum({ source, site });
  assert.equal(await readFile(payloadPath, "utf8"), previous, "upload rebuild is deterministic");
  for (const [mutate, error] of [
    [(value) => { value.images[0].sha256 = "0".repeat(64); }, /hash mismatch/],
    [(value) => { value.images[0].thumbnail.sha256 = "0".repeat(64); }, /hash mismatch/],
    [(value) => { value.images[0].path = "../outside.jpg"; }, /Invalid source path/],
    [(value) => { value.images[0].width = 0; }, /dimensions/],
    [(value) => { value.date = "2025-01-01"; }, /year mismatch/],
    [(value) => { value.date = "2026-02-30"; }, /Invalid publication date/],
    [(value) => { delete value.year; }, /year/],
    [(value) => { value.releaseType = "typo"; }, /release type/],
    [(value) => { value.source.kind = "wechat"; }, /upload/i],
    [(value) => { value.images[1].id = value.images[0].id; }, /Duplicate/],
    [(value) => { value.reviewStatus = "needs_review"; }, /Unverified/],
    [(value) => { value.description = null; }, /Incomplete upload/],
  ]) {
    const invalid = structuredClone(entry);
    mutate(invalid);
    await save("entries/upload-wing-2026.json", [invalid]);
    await assert.rejects(buildOfficialAlbum({ source, site }), error);
    assert.equal(await readFile(payloadPath, "utf8"), previous, "invalid data must not replace public output");
  }
  entry.date = "2026-03-02";
  await save("entries/upload-wing-2026.json", [entry]);
  await buildOfficialAlbum({ source, site });
  const dated = JSON.parse(await readFile(payloadPath, "utf8"));
  assert.equal(dated.items[0].date, "2026年3月2日");
  assert.equal(dated.items[0].datePrecision, "day");
  entry.description = "";
  await save("entries/upload-wing-2026.json", [entry]);
  await buildOfficialAlbum({ source, site });
  const titleOnly = JSON.parse(await readFile(payloadPath, "utf8"));
  assert.equal(titleOnly.items.length, 2, "name-only work must retain both images");
  assert.ok(titleOnly.items.every((item) => item.title === "先金羽翼" && item.caption === ""), "empty descriptions must remain empty");
  console.log("PASS uploaded photos, year-only dates, exact bytes, thumbnails, deterministic build and safe validation failure");
} finally {
  await rm(temp, { recursive: true, force: true });
}
