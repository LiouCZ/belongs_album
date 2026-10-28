import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const playwrightRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"))
  : require;
const { chromium } = playwrightRequire("playwright");
const sharp = playwrightRequire("sharp");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    for (const filename of ["index.html", "player.html"]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`file://${path.join(root, filename)}`);
      if (filename === "index.html") await page.locator("#closeIntro").click();

      const thumb = page.locator(".gallery .thumb").first();
      assert.match(await thumb.evaluate((element) => getComputedStyle(element).cursor), /hourglass-cursor\.png/);
      assert.equal(await page.locator("#searchInput").evaluate((element) => getComputedStyle(element).cursor), "text");

      await thumb.click();
      assert.equal(await page.locator("#detailDialog").isVisible(), true);
      assert.match(await page.locator("#detailImage").evaluate((element) => getComputedStyle(element).cursor), /hourglass-cursor\.png/);
      assert.equal(await page.locator("#closeDialog").evaluate((element) => getComputedStyle(element).cursor), "pointer");

      const cursorLoaded = await page.evaluate(() => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth === 32 && image.naturalHeight === 32);
        image.onerror = () => resolve(false);
        image.src = new URL("assets/hourglass-cursor.png", location.href).href;
      }));
      assert.equal(cursorLoaded, true);
      await page.close();
    }

    const story = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await story.goto(`file://${path.join(root, "brand-story.html")}`);
    for (const selector of [".brand-illustration img", ".philosophy-chapter img", ".story-feature-image img", ".story-media img"]) {
      assert.match(await story.locator(selector).first().evaluate((element) => getComputedStyle(element).cursor), /hourglass-cursor\.png/, selector);
    }
    assert.equal(await story.locator(".story-source-button").first().evaluate((element) => getComputedStyle(element).cursor), "pointer");
    assert.doesNotMatch(await story.locator(".brand-logo").evaluate((element) => getComputedStyle(element).cursor), /hourglass-cursor\.png/);
    await story.close();

    const { data, info } = await sharp(path.join(root, "assets/hourglass-cursor.png")).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x + 1) * info.channels)];
    assert.equal(pixel(0, 0)[3], 0);
    assert.ok(pixel(9, 6)[3] > 180 && pixel(9, 6)[0] < 80);

    const touch = await browser.newPage({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    await touch.goto(`file://${path.join(root, "player.html")}`);
    assert.doesNotMatch(await touch.locator(".gallery .thumb").first().evaluate((element) => getComputedStyle(element).cursor), /hourglass-cursor\.png/);
    await touch.goto(`file://${path.join(root, "brand-story.html")}`);
    assert.doesNotMatch(await touch.locator(".brand-illustration img").evaluate((element) => getComputedStyle(element).cursor), /hourglass-cursor\.png/);
    await touch.close();
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
