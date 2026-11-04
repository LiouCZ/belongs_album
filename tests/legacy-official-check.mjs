import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runtimeRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json")) : require;
const { chromium } = runtimeRequire("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`file://${path.join(root, "index.html")}`);
    await page.locator("#closeIntro").click();
    const dates = await page.evaluate(() => state.groups.map((group) => {
      const match = group.date.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
      return match ? Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]) : null;
    }));
    assert.equal(dates.every((date) => date !== null), true, "recovered publication dates must be explicit");
    assert.deepEqual(dates, [...dates].sort((a, b) => a - b), "all historical/new groups must sort together by publication date");
    assert.equal(await page.evaluate(() => new Set(state.items.map((item) => item.id)).size), 1053);
    for (const view of ["grid", "list"]) {
      await page.locator(`#viewSwitch [data-view="${view}"]`).click();
      await page.locator("#searchInput").fill("侘寂之美");
      assert.equal(await page.locator("#gallery .card").count(), 1);
      await page.locator("#gallery .card").click();
      assert.equal(await page.locator("#detailTitle").textContent(), "侘寂之美");
      assert.equal(await page.locator("#carouselCount").textContent(), "1 / 9");
      assert.match(await page.locator("#detailCaption").textContent(), /侘寂和粗制滥造是完全的两极/);
      assert.ok(await page.locator("#detailCaption .detail-paragraph").count() > 5);
      assert.equal(await page.locator("#openArticle").isHidden(), true, "legacy records must not fabricate WeChat article links");
      await page.locator("#nextImage").click();
      assert.equal(await page.locator("#carouselCount").textContent(), "2 / 9");
      await page.waitForFunction(() => {
        const image = document.querySelector("#detailImage");
        return image.complete && image.naturalWidth > 0;
      });
      if (width > 860) {
        assert.equal(await page.locator("#detailDialog").evaluate((dialog) => {
          const image = dialog.querySelector("#detailImage").getBoundingClientRect();
          const controls = dialog.querySelector("#carouselControls").getBoundingClientRect();
          const box = dialog.getBoundingClientRect();
          return image.top >= box.top && image.bottom <= box.bottom && controls.bottom <= box.bottom
            && image.bottom <= controls.top;
        }), true, "restored long captions must not push the image or carousel controls outside the desktop dialog");
      }
      await page.locator("#closeDialog").click();
      await page.locator("#searchInput").fill("风中飞扬");
      assert.equal(await page.locator("#gallery .card").count(), 1);
      assert.match(await page.locator("#gallery .meta").textContent(), /2022年7月4日/);
      await page.locator("#gallery .card").click();
      assert.match(await page.locator("#detailCaption").textContent(), /Belongs的首支定款羽毛——初心羽/);
      await page.locator("#closeDialog").click();
      await page.locator("#searchInput").fill("你好,2022");
      assert.equal(await page.locator("#gallery .card").count(), 1);
      assert.match(await page.locator("#gallery .meta").textContent(), /2022年1月14日/);
      await page.locator("#searchInput").fill("");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log(`PASS migrated legacy dates, full narratives, original carousels and grid/list compatibility ${width}px`);
    await page.close();
  }
} finally {
  await browser.close();
}
