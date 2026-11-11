import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOfficialAlbum } from "../scripts/build-official-album.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonical = path.resolve(root, "../album_source");
const temp = await mkdtemp(path.join(os.tmpdir(), "belongs-release-build-"));
const source = path.join(temp, "source");
const site = path.join(temp, "site");
const slug = "ZaunOWM_hnsku97nyFtJhA";
const save = (relative, payload) => writeFile(path.join(source, relative), JSON.stringify(payload));
try {
  await mkdir(path.join(source, "entries"), { recursive: true });
  await mkdir(path.join(source, "articles"));
  const legacy = JSON.parse(await readFile(path.join(canonical, "entries/legacy-2021.json"), "utf8")).slice(0, 1);
  const article = JSON.parse(await readFile(path.join(canonical, `articles/${slug}.json`), "utf8"));
  const entries = JSON.parse(await readFile(path.join(canonical, `entries/${slug}.json`), "utf8"));
  article.workIds = entries.slice(0, 2).map((entry) => entry.id);
  entries.length = 2;
  entries[0].releaseType = "regular";
  entries[1].releaseType = "invited";
  for (const entry of [...legacy, ...entries]) {
    for (const image of entry.images) {
      for (const asset of [image, image.thumbnail].filter(Boolean)) {
        const target = path.join(source, asset.path);
        await mkdir(path.dirname(target), { recursive: true });
        await cp(path.join(canonical, asset.path), target);
      }
    }
  }
  await save("legacy-manifest.json", { schemaVersion: 1, legacyFiles: ["entries/legacy-2021.json"], requiredImageIds: legacy.flatMap((entry) => entry.images.map((image) => image.id)) });
  await save("entries/legacy-2021.json", legacy);
  await save(`articles/${slug}.json`, article);
  await save(`entries/${slug}.json`, entries);
  await buildOfficialAlbum({ source, site });
  let payload = JSON.parse(await readFile(path.join(site, "data/curated-official.json"), "utf8"));
  assert.deepEqual(payload.articles[0].works.map((work) => work.releaseType), ["regular", "invited"], "per-work release types must survive the article build");
  assert.deepEqual(payload.items.map((item) => item.releaseType), ["regular", "invited"], "browser images need their work's release type");
  delete entries[0].releaseType;
  await save(`entries/${slug}.json`, entries);
  legacy[0].releaseType = "invited";
  await save("entries/legacy-2021.json", legacy);
  await buildOfficialAlbum({ source, site });
  const historical = JSON.parse(await readFile(path.join(site, "data/items.json"), "utf8"));
  assert.ok(historical.items.every((item) => item.releaseType === "invited"), "historical entries can be explicitly reassigned without losing images");
  payload = JSON.parse(await readFile(path.join(site, "data/curated-official.json"), "utf8"));
  assert.equal(payload.items[0].releaseType ?? "regular", "regular", "unmarked old records remain compatible");
  const previous = await readFile(path.join(site, "data/items.json"), "utf8");
  entries[1].releaseType = "typo";
  await save(`entries/${slug}.json`, entries);
  await assert.rejects(buildOfficialAlbum({ source, site }), /Invalid release type/);
  assert.equal(await readFile(path.join(site, "data/items.json"), "utf8"), previous, "invalid new data must not overwrite existing output");
  entries[1].releaseType = "invited";
  await save(`entries/${slug}.json`, entries);
  legacy[0].releaseType = "typo";
  await save("entries/legacy-2021.json", legacy);
  await assert.rejects(buildOfficialAlbum({ source, site }), /Invalid release type/);
  console.log("PASS per-work release types, legacy compatibility and invalid-type rejection");
} finally {
  await rm(temp, { recursive: true, force: true });
}
