import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(path.join(os.tmpdir(), "belongs-story-source-"));
try {
  for (const relative of ["scripts/build-story-catalog.mjs", "docs/brand-story-article-inventory.md", "data/items.json"]) {
    const target = path.join(temp, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(root, relative), target);
  }
  symlinkSync(path.join(root, "assets"), path.join(temp, "assets"), "dir");
  execFileSync(process.execPath, [path.join(temp, "scripts/build-story-catalog.mjs")], { stdio: "pipe" });
  const readStories = (file) => {
    const context = vm.createContext({ window: {} });
    vm.runInContext(readFileSync(file, "utf8"), context);
    return JSON.parse(JSON.stringify(context.window.BELONGS_STORIES));
  };
  const generated = readStories(path.join(temp, "data/story-catalog.js"));
  const current = readStories(path.join(root, "data/story-catalog.js"));
  assert.equal(generated.length, 93);
  assert.deepEqual(generated.map(({ key, id, sourceIds }) => ({ key, id, sourceIds })),
    current.map(({ key, id, sourceIds }) => ({ key, id, sourceIds })), "all story references must keep their existing image identities");
  assert.deepEqual(current.map(({ key, sourceSections }) => ({ key, sourceSections })),
    generated.map(({ key, sourceSections }) => ({ key, sourceSections })), "published story quotes must stay synchronized with canonical source text");
  for (const story of generated) {
    const sections = story.sourceSections.map((section) => section.text);
    assert.equal(new Set(sections).size, sections.length, `${story.title}: reconstructed work text must be quoted once`);
  }
  assert.match(generated.find((story) => story.title === "侘寂之美").sourceSections[0].text, /侘寂和粗制滥造是完全的两极/);
  console.log("PASS all 93 brand-story references, source quotes and deduplicated reconstructed narratives");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
