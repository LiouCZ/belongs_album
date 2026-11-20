import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(process.env.PLAYWRIGHT_MODULE_DIR
  ? path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json") : import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto(pathToFileURL(path.join(root, "brand-story.html")).href);
  await page.evaluate(() => window.BelongsI18n.setLanguage("en"));
  assert.equal(await page.locator(".story-feature h3").first().textContent(), "Wabi-sabi: the hand at work");

  const coverage = await page.evaluate(() => {
    const gaps = [];
    for (const story of window.BELONGS_STORIES) {
      for (const field of ["title", "summary", "topic", "quote", "kind"]) {
        if (!story[field]) continue;
        const fields = window.BELONGS_EN.stories[story.id];
        const entry = fields?.[`${field}:${story.year}`] || fields?.[field];
        if (entry?.source !== story[field] || !entry.en) gaps.push(`${story.key}.${field}`);
      }
    }
    const sourceGaps = [...new Set(window.BELONGS_STORIES.flatMap((story) => story.sourceSections
      .flatMap((section) => section.text.split("\n"))))]
      .filter((line) => /[\u3400-\u9fff]/u.test(line) && !window.BELONGS_EN.text[line.replace(/\s+/g, " ").trim()]);
    return { count: window.BELONGS_STORIES.length, ids: Object.keys(window.BELONGS_EN.stories).length, gaps, sourceGaps };
  });
  assert.equal(coverage.count, 93);
  assert.equal(coverage.ids, 89);
  assert.deepEqual(coverage.gaps, [], "every directory field needs an exact-source translation");
  assert.equal(coverage.sourceGaps.length, 0, `untranslated source paragraphs: ${coverage.sourceGaps.slice(0,3).join("; ")}`);

  await page.locator("#storyNextPage").click();
  const secondPage = await page.locator(".story-entry h3").allTextContents();
  await page.locator(".story-feature [data-story-key]").first().click();
  assert.equal(await page.locator("#storySourceTitle").textContent(), "The Beauty of Wabi-sabi");
  assert.match(await page.locator("#storySourceBody").textContent(), /shoddy workmanship/i);
  await page.evaluate(() => window.BelongsI18n.setLanguage("zh"));
  assert.equal(await page.locator("#storySourceDialog").evaluate((node) => node.open), true);
  assert.equal(await page.locator("#storySourceTitle").textContent(), "侘寂之美");
  assert.match(await page.locator("#storySourceBody").textContent(), /侘寂和粗制滥造是完全的两极/);
  assert.match(await page.locator("#storyPageInfo").textContent(), /2 \/ 8/);
  await page.evaluate(() => window.BelongsI18n.setLanguage("en"));
  assert.deepEqual(await page.locator(".story-entry h3").allTextContents(), secondPage);
  await page.locator("#storySourceClose").click();

  await page.locator('[data-year="2022"]').click();
  await page.locator("#storySearch").fill("original intention");
  assert.ok(await page.locator(".story-entry").count() > 0, "English search works");
  const results = await page.locator(".story-entry [data-story-key]").evaluateAll((nodes) => nodes.map((node) => node.dataset.storyKey));
  await page.evaluate(() => window.BelongsI18n.setLanguage("zh"));
  assert.equal(await page.locator("#storySearch").inputValue(), "original intention");
  assert.deepEqual(await page.locator(".story-entry [data-story-key]").evaluateAll((nodes) => nodes.map((node) => node.dataset.storyKey)), results);
  assert.equal(await page.locator('[data-year="2022"]').getAttribute("aria-pressed"), "true");
  await page.locator("#storySearch").fill("初心羽");
  assert.ok(await page.locator(".story-entry").count() > 0, "Chinese search remains available");
  await page.evaluate(() => window.BelongsI18n.setLanguage("en"));
  assert.ok(await page.locator(".story-entry").count() > 0);

  await page.locator("#storySearch").fill("");
  await page.locator('[data-year="2024—2026"]').click();
  assert.equal(await page.locator(".story-entry").count(), 7);
  assert.ok((await page.locator(".story-entry h3").allTextContents()).includes("The Hourglass and Time"));
  await page.locator('.story-entry [data-story-key="2024—2026-2023-012-75ae4db4cd"]').click();
  assert.equal(await page.locator("#storySourceTitle").textContent(), "The Cross, Light and Hope");
  assert.equal(await page.locator(".story-source-section").count(), 3);
  await page.evaluate(() => window.BelongsI18n.setLanguage("zh"));
  assert.equal(await page.locator("#storySourceTitle").textContent(), "十字、光与希望");
  await page.locator("#storySourceClose").click();

  await page.evaluate(() => {
    const story = window.BELONGS_STORIES.find((entry) => entry.id === "2021-148-309cfd3f0d");
    story.title = "修改后的中文标题";
    story.summary = "修改后的中文摘要";
    window.BelongsI18n.setLanguage("en");
  });
  await page.locator('[data-year="2021"]').click();
  assert.ok((await page.locator(".story-entry h3").allTextContents()).includes("修改后的中文标题"));
  assert.match(await page.locator("#storyCatalog").textContent(), /修改后的中文摘要/);
  await page.locator(".story-feature [data-story-key]").first().click();
  assert.equal(await page.locator("#storySourceTitle").textContent(), "修改后的中文标题");
  console.log("story i18n checks passed: 93 entries / 89 stable IDs, bilingual search, exact-source fallback and open-dialog state");
} finally {
  await browser.close();
}
