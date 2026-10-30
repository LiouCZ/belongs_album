import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runtimeRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"))
  : require;
const sharp = runtimeRequire("sharp");
const { chromium } = runtimeRequire("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function run() {
  const { data, info } = await sharp(path.join(root, "assets/belongs-logo.png")).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x + 1) * info.channels)];
  assert.equal(pixel(0, 0)[3], 0);
  assert.equal(pixel(333, 50)[3], 0);
  assert.ok(pixel(220, 140)[3] > 220 && pixel(220, 140)[0] < 80);

  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${path.join(root, "player.html")}`);
    assert.equal(await page.locator(".brand-mark").evaluate((element) => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
    assert.equal((await page.locator(".brand-mark").boundingBox()).width, 64, "desktop brand mark should be a little larger");
    assert.match(await page.locator(".brand-logo").evaluate((element) => getComputedStyle(element).filter), /drop-shadow/);
    await page.goto(`file://${path.join(root, "index.html")}?view=list`);
    assert.match(await page.locator(".brand-logo").evaluate((element) => getComputedStyle(element).filter), /invert\(1\)/);
    await page.close();
    for (const filename of ["index.html", "index.html?view=list", "player.html", "brand-story.html"]) {
      for (const width of [320, 390]) {
        const mobile = await browser.newPage({ viewport: { width, height: 900 } });
        await mobile.goto(`file://${path.join(root, filename)}`);
        const mark = await mobile.locator(".brand-mark").boundingBox();
        assert.equal(mark.width, filename.includes("view=list") ? 48 : 56);
        assert.equal(await mobile.evaluate(() => {
          const mark = document.querySelector(".brand-mark").getBoundingClientRect();
          const text = document.querySelector(".brand > div:last-child").getBoundingClientRect();
          return document.documentElement.scrollWidth <= innerWidth && mark.right <= text.left && text.right <= innerWidth;
        }), true, "enlarged logo must not crowd the brand text");
        await mobile.close();
      }
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
