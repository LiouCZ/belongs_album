import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const playwrightRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"))
  : require;
const { chromium } = playwrightRequire("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function checkIntro(page) {
  await page.goto(`file://${path.join(root, "index.html")}`);
  const dialog = page.locator("#introDialog");
  await dialog.waitFor({ state: "visible" });
  assert.equal(await dialog.evaluate((element) => element.open), true);
  assert.equal(await page.locator("#introCount").textContent(), "1 / 3");

  const image = page.locator("#introImage");
  assert.match(await image.getAttribute("src"), /intro\/serpent\.png$/);
  assert.equal(await image.evaluate((element) => element.complete && element.naturalWidth > 0), true);

  await page.locator("#nextIntro").click();
  assert.equal(await page.locator("#introCount").textContent(), "2 / 3");
  assert.match(await image.getAttribute("src"), /intro\/eagle\.png$/);
  assert.equal(await image.evaluate(async (element) => {
    await element.decode();
    return element.naturalWidth > 0;
  }), true);
  await page.locator("#nextIntro").click();
  assert.equal(await page.locator("#introCount").textContent(), "3 / 3");
  assert.match(await image.getAttribute("src"), /intro\/cross\.png$/);
  assert.equal(await image.evaluate(async (element) => {
    await element.decode();
    return element.naturalWidth > 0;
  }), true);
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.locator("#introCount").textContent(), "2 / 3");
  await page.locator("#nextIntro").click();
  assert.equal(await page.locator("#introCount").textContent(), "3 / 3");
  await page.locator("#nextIntro").click();
  assert.equal(await page.locator("#introCount").textContent(), "1 / 3");
  await page.locator("#prevIntro").click();
  assert.equal(await page.locator("#introCount").textContent(), "3 / 3");

  await page.locator("#closeIntro").click();
  assert.equal(await dialog.isVisible(), false);
  await page.reload();
  await dialog.waitFor({ state: "visible" });
  assert.equal(await page.locator("#introCount").textContent(), "1 / 3");
}

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await checkIntro(desktop);
    await desktop.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(`file://${path.join(root, "index.html")}`);
    await mobile.locator("#introDialog").waitFor({ state: "visible" });
    const sizes = await mobile.locator("#introImage").evaluate((image) => {
      const box = image.getBoundingClientRect();
      return { width: box.width, height: box.height, viewportWidth: innerWidth, viewportHeight: innerHeight, fit: getComputedStyle(image).objectFit };
    });
    assert.equal(sizes.fit, "contain");
    assert.ok(sizes.width <= sizes.viewportWidth && sizes.height < sizes.viewportHeight);
    await mobile.close();

    const player = await browser.newPage();
    await player.goto(`file://${path.join(root, "player.html")}`);
    assert.equal(await player.locator("#introDialog").count(), 0);
    await player.close();
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
