import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  const fixture = await browser.newPage();
  await fixture.addInitScript(() => {
    const item = (id, date, datePrecision, sourceIndex) => ({ id, date, datePrecision, sourceIndex, index: sourceIndex, year: "2026", title: id, caption: "", releaseType: "invited" });
    Object.defineProperty(window, "BELONGS_DATA", { value: { items: [item("year-only", "2026", "year", 1), item("late", "2026年12月31日", "day", 2), item("early", "2026年1月1日", "day", 3)] }, writable: false });
    Object.defineProperty(window, "BELONGS_CURATED", { value: { articles: [], items: [] }, writable: false });
  });
  await fixture.goto(`file://${path.join(root, "index.html")}?release=invited`);
  assert.deepEqual(await fixture.locator("#gallery h3").allTextContents(), ["early", "late", "year-only"], "year-only records must not borrow another work's month/day");
  assert.equal((await fixture.locator("#gallery .meta").allTextContents()).at(-1), "2026 年");
  await fixture.close();

  for (const width of [1440, 390, 320]) {
    for (const view of ["grid", "list"]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`file://${path.join(root, "index.html")}?release=invited&view=${view}`);
      await page.locator("#closeIntro").click();
      assert.equal(await page.locator("#totalCount").textContent(), "1");
      assert.equal(await page.locator("#gallery h3").textContent(), "先金羽翼");
      assert.equal(await page.locator("#gallery .meta").textContent(), "2026 年");
      assert.equal(await page.locator("#gallery .excerpt").count(), 0, "name-only uploaded work must not display a description placeholder");
      assert.deepEqual(await page.locator("#yearFilter option").evaluateAll((nodes) => nodes.map((node) => node.value)), ["all", "2026"]);
      await page.locator("#yearFilter").selectOption("2026");
      await page.locator("#categorySelect").selectOption("先金羽翼");
      await page.locator("#searchInput").fill("先金羽翼");
      assert.equal(await page.locator("#gallery .card").count(), 1);
      await page.locator("#gallery .card").click();
      assert.equal(await page.locator("#detailTitle").textContent(), "先金羽翼");
      assert.equal(await page.locator("#detailMeta").textContent(), "2026 年 · 邀约作品");
      assert.equal(await page.locator("#detailCaption").textContent(), "");
      assert.equal(await page.locator("#detailCaption").isHidden(), true, "name-only detail must not display a description or placeholder");
      assert.equal(await page.locator("#openArticle").isHidden(), true);
      assert.equal(await page.locator("#carouselCount").textContent(), "1 / 2");
      await page.waitForFunction(() => document.querySelector("#detailImage").naturalWidth > 0);
      assert.match(await page.locator("#detailImage").getAttribute("src"), /front/);
      await page.locator("#nextImage").click();
      await page.waitForFunction(() => document.querySelector("#detailImage").complete && document.querySelector("#detailImage").naturalWidth > 0);
      assert.match(await page.locator("#detailImage").getAttribute("src"), /back/);
      assert.equal(await page.locator("#carouselCount").textContent(), "2 / 2");
      assert.equal(await page.locator("#detailImage").evaluate((node) => getComputedStyle(node).objectFit), "contain");
      await page.locator("#prevImage").click();
      assert.equal(await page.locator("#carouselCount").textContent(), "1 / 2");
      assert.equal(await page.evaluate(() => {
        const caption = document.querySelector("#detailCaption");
        return document.documentElement.scrollWidth <= innerWidth && [...caption.querySelectorAll("p, dt, dd")].every((node) => node.scrollWidth <= node.clientWidth + 1);
      }), true, "name-only work must fit at desktop and mobile sizes");
      if (process.env.UPLOAD_SCREENSHOT_DIR) {
        mkdirSync(process.env.UPLOAD_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.UPLOAD_SCREENSHOT_DIR, `wing-${width}-${view}.png`) });
      }
      await page.locator("#closeDialog").click();
      await page.locator("#searchInput").fill("");
      await page.locator('[data-release-type="regular"]').click();
      assert.equal(await page.locator("#totalCount").textContent(), "766");
      assert.equal(await page.evaluate(() => releaseGroups().reduce((count, group) => count + group.imageCount, 0)), 1059);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS name-only invited wing, category, year and carousel ${width}px ${view}`);
    }
  }
} finally {
  await browser.close();
}
