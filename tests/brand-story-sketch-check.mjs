import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
    for (const width of [1280, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`file://${path.join(root, "brand-story.html")}`);
      const sketch = page.locator(".story-sketch");
      assert.equal(await sketch.count(), 1, "the opening image should have one handwriting scene");
      await page.waitForFunction(() => document.querySelector(".story-sketch").dataset.sketchState === "drawing");
      const timing = await sketch.evaluate((figure) => {
        const animations = figure.getAnimations({ subtree: true });
        for (const animation of animations) { animation.pause(); animation.currentTime = 0; }
        return animations.map((animation) => animation.effect.getComputedTiming().endTime);
      });
      assert.ok(timing.length > 20, "the feather and lettering should reveal stroke by stroke");
      assert.equal(Math.max(...timing), 5000, "the entire sequence must finish at five seconds");
      assert.equal(await sketch.locator(".sketch-original").evaluate((image) => getComputedStyle(image).opacity), "0");
      assert.equal(await sketch.locator(".sketch-ink path").evaluateAll((paths) => paths.every((path) => getComputedStyle(path).opacity === "0")), true, "future strokes must not leave dots before drawing starts");
      const start = await sketch.screenshot();
      await sketch.evaluate((figure) => {
        for (const animation of figure.getAnimations({ subtree: true })) animation.currentTime = 3500;
      });
      const middle = await sketch.screenshot();
      assert.equal(start.equals(middle), false, "ink should become visible during the sequence");
      await sketch.evaluate((figure) => {
        for (const animation of figure.getAnimations({ subtree: true })) animation.finish();
      });
      await page.waitForFunction(() => document.querySelector(".story-sketch").dataset.sketchState === "complete");
      assert.equal(await sketch.locator(".sketch-original").evaluate((image) => getComputedStyle(image).opacity), "1");
      assert.equal(await sketch.locator(".sketch-ink").isHidden(), true);
      const final = await sketch.screenshot();
      assert.equal(start.equals(final), false, "the initial frame must not already contain the full drawing");
      const box = await sketch.boundingBox();
      assert.ok(Math.abs(box.width / box.height - 831 / 552) < 0.01, "crop only the three-pixel white strip");
      assert.ok(box.y < page.viewportSize().height - Math.min(160, box.height), "the opening animation should be visible on page entry");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const original = await sketch.locator(".sketch-original").getAttribute("src");
      const originalPixels = await sharp(path.join(root, original)).ensureAlpha().raw().toBuffer();
      assert.equal(createHash("sha256").update(originalPixels).digest("hex"), "751e0713b6627a309599e0929124965e1d181eb3ef38519bbc12cedbc7ca36ae", "the final artwork should preserve all pixels except the white strip");
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS five-second handwriting scene ${width}px`);
    }

    for (const options of [{ reducedMotion: "reduce" }, { javaScriptEnabled: false }]) {
      const page = await browser.newPage(options);
      await page.goto(`file://${path.join(root, "brand-story.html")}`);
      const sketch = page.locator(".story-sketch");
      assert.equal(await sketch.locator(".sketch-original").evaluate((image) => getComputedStyle(image).opacity), "1");
      assert.equal(await sketch.evaluate((figure) => figure.getAnimations({ subtree: true }).length), 0);
      assert.equal(await sketch.locator(".sketch-original").evaluate(async (image) => {
        await image.decode();
        return image.naturalWidth === 831 && image.naturalHeight === 552;
      }), true);
      await page.close();
    }
    console.log("PASS static fallback without motion or JavaScript");
    const preference = await browser.newPage();
    await preference.goto(`file://${path.join(root, "brand-story.html")}`);
    await preference.waitForFunction(() => document.querySelector(".story-sketch").dataset.sketchState === "drawing");
    await preference.emulateMedia({ reducedMotion: "reduce" });
    await preference.waitForFunction(() => document.querySelector(".story-sketch").dataset.sketchState === "complete");
    assert.equal(await preference.locator(".story-sketch").evaluate((figure) => figure.getAnimations({ subtree: true }).length), 0);
    await preference.close();
    console.log("PASS changing motion preferences stops the running animation");
  } finally {
    await browser.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
