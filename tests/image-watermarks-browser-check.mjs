import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = process.env.PLAYWRIGHT_MODULE_DIR ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json")) : createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const screenshots = process.env.WATERMARK_SCREENSHOTS;
if (screenshots) await mkdir(screenshots, { recursive: true });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("belongs:intro-seen", "1"));
    for (const [file, suffix] of [["index.html", "2025-095-0294d8da2c.jpg"], ["player.html", "wing-25-2.jpg"]]) {
      await page.goto(`file://${path.join(root, file)}`);
      await page.evaluate((suffix) => {
        const group = state.groups.find((group) => group.items.some((item) => item.image.endsWith(suffix)));
        if (!group) throw new Error(`Missing photo: ${suffix}`);
        openDetail(group);
        state.activeImageIndex = group.items.findIndex((item) => item.image.endsWith(suffix));
        renderDetailImage();
      }, suffix);
      await page.waitForFunction(() => els.detailImage.complete && els.detailImage.naturalWidth > 0);
      const result = await page.evaluate(() => {
        const img = els.detailImage, box = img.getBoundingClientRect(), dialog = els.dialog.getBoundingClientRect();
        return { loaded: img.naturalWidth > 0, fit: getComputedStyle(img).objectFit, contained: box.left >= dialog.left - 1 && box.right <= dialog.right + 1, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.deepEqual(result, { loaded: true, fit: "contain", contained: true, overflow: false }, `${file} ${width}px: preserve the full watermarked frame`);
      if (screenshots) await page.screenshot({ path: path.join(screenshots, `${file}-${width}.png`) });
      if (file === "index.html") {
        await page.evaluate(() => { closeDetail(); openArticle([...state.articles.keys()][0]); });
        await page.locator(".article-work-images img").first().waitFor();
        await page.waitForFunction(() => [...els.articleBody.querySelectorAll("img")].every((img) => img.complete && img.naturalWidth));
        if (screenshots) await page.screenshot({ path: path.join(screenshots, `article-${width}.png`) });
      }
    }
    await page.goto(`file://${path.join(root, "brand-story.html")}`);
    const feature = page.locator(".story-feature-image").first();
    await feature.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const img = document.querySelector(".story-feature-image img");
      return img?.complete && img.naturalWidth > 0;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    if (screenshots) await page.screenshot({ path: path.join(screenshots, `story-${width}.png`) });
    assert.deepEqual(errors, [], `${width}px: browser errors`);
    await page.close();
    console.log(`PASS watermarked official/player details, complete frames, article photos and story reuse: ${width}px`);
  }
} finally { await browser.close(); }
