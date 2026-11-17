import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOfficialAlbum } from "../scripts/build-official-album.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonical = path.resolve(root, "../album_source");
const temp = await mkdtemp(path.join(os.tmpdir(), "belongs-cover-stamps-"));
const source = path.join(temp, "source");
const site = path.join(temp, "site");
const slug = "ZaunOWM_hnsku97nyFtJhA";
const save = (relative, value) => writeFile(path.join(source, relative), JSON.stringify(value));
try {
  await mkdir(path.join(source, "entries"), { recursive: true });
  await mkdir(path.join(source, "articles"));
  const legacy = JSON.parse(await readFile(path.join(canonical, "entries/legacy-2021.json"), "utf8")).slice(0, 1);
  const article = JSON.parse(await readFile(path.join(canonical, `articles/${slug}.json`), "utf8"));
  const entries = JSON.parse(await readFile(path.join(canonical, `entries/${slug}.json`), "utf8")).slice(0, 2);
  const uploads = JSON.parse(await readFile(path.join(canonical, "entries/upload-2026-custom-gold-opal-coin.json"), "utf8"));
  legacy[0].coverStamps = ["antique"];
  entries[0].coverStamps = ["gold"];
  delete entries[1].coverStamps;
  uploads[0].coverStamps = ["antique", "gold"];
  uploads[0].coverStampPosition = "bottom-left";
  uploads[0].reviewNotes = "Internal verification evidence, not public copy";
  article.workIds = entries.map((entry) => entry.id);
  for (const entry of [...legacy, ...entries, ...uploads]) {
    for (const image of entry.images) {
      for (const asset of [image, image.thumbnail].filter(Boolean)) {
        const target = path.join(source, asset.path);
        await mkdir(path.dirname(target), { recursive: true });
        await cp(path.join(canonical, asset.path), target);
      }
    }
  }
  await save("legacy-manifest.json", { schemaVersion: 1, legacyFiles: ["entries/legacy-2021.json"], requiredImageIds: legacy.flatMap((entry) => entry.images.map((image) => image.id)) });
  const saveEntries = async () => {
    await save("entries/legacy-2021.json", legacy);
    await save(`entries/${slug}.json`, entries);
    await save("entries/upload-test.json", uploads);
  };
  await save(`articles/${slug}.json`, article);
  await saveEntries();
  await buildOfficialAlbum({ source, site });
  const history = JSON.parse(await readFile(path.join(site, "data/items.json"), "utf8"));
  const curatedFile = path.join(site, "data/curated-official.json");
  const curated = JSON.parse(await readFile(curatedFile, "utf8"));
  assert.ok(history.items.every((item) => item.coverStamps?.join() === "antique"), "legacy stamps must reach every carousel image");
  assert.deepEqual(curated.articles[0].works[0].coverStamps, ["gold"], "article works need explicit stamp metadata");
  assert.deepEqual(curated.items[0].coverStamps, ["gold"]);
  assert.equal(curated.items[1].coverStamps, undefined, "unmarked old data must stay unmarked");
  const uploaded = curated.items.filter((item) => item.workId === uploads[0].id);
  assert.equal(uploaded.length, 2);
  for (const [index, item] of uploaded.entries()) {
    assert.deepEqual(item.coverStamps, ["gold", "antique"], "dual stamps have a stable display order");
    assert.equal(item.coverStampPosition, "bottom-left");
    assert.equal(item.caption, "", "name-only works must not gain generated prose");
    assert.ok((await readFile(path.join(site, item.image))).equals(await readFile(path.join(source, uploads[0].images[index].path))), "stamps must not be burned into photos");
  }
  const before = await readFile(curatedFile, "utf8");
  assert.ok(!before.includes("Internal verification evidence"), "review notes must remain outside public payloads");
  await buildOfficialAlbum({ source, site });
  assert.equal(await readFile(curatedFile, "utf8"), before, "stamp metadata must survive deterministic rebuilding");
  for (const entry of [legacy[0], entries[0], uploads[0]]) {
    const valid = entry.coverStamps;
    for (const invalid of [["typo"], ["gold", "gold"], "gold", null]) {
      entry.coverStamps = invalid;
      await saveEntries();
      await assert.rejects(buildOfficialAlbum({ source, site }), /Invalid cover stamps/);
      assert.equal(await readFile(curatedFile, "utf8"), before, "invalid tags must not replace public output");
    }
    entry.coverStamps = valid;
  }
  uploads[0].coverStampPosition = "middle";
  await saveEntries();
  await assert.rejects(buildOfficialAlbum({ source, site }), /Invalid cover stamp position/);
  console.log("PASS explicit stamps, all source types, dual order, exact photo bytes and safe validation failure");
} finally {
  await rm(temp, { recursive: true, force: true });
}
