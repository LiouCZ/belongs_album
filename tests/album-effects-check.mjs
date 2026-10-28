import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runtimeRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"))
  : require;
const { chromium } = runtimeRequire("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function openAlbum(browser, filename, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, ...options });
  page.setDefaultTimeout(5000);
  await page.goto(`file://${path.join(root, filename)}`);
  if (filename === "index.html") await page.locator("#closeIntro").click();
  return page;
}

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    for (const filename of ["index.html", "player.html"]) {
      const page = await openAlbum(browser, filename);
      const card = page.locator(".gallery .card").first();
      const box = await card.boundingBox();
      await page.mouse.move(box.x + 28, box.y + 30);
      assert.equal(await card.evaluate((element) => element.style.getPropertyValue("--glint-x")), "28px");
      assert.match(await card.evaluate((element) => getComputedStyle(element, "::after").backgroundImage), /radial-gradient/);

      await card.click();
      const image = page.locator("#detailImage");
      await image.waitFor({ state: "visible" });
      const imageBox = await image.boundingBox();
      await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
      const lens = page.locator("#detailLens");
      assert.equal(await lens.isVisible(), true);
      assert.match(await lens.evaluate((element) => getComputedStyle(element).backgroundImage), /url\(/);
      await page.locator("#closeDialog").click();
      assert.equal(await lens.isVisible(), false);
      await page.close();
    }

    const carousel = await openAlbum(browser, "index.html");
    await carousel.locator(".gallery .card", { has: carousel.locator(".image-count") }).first().click();
    await carousel.locator("#detailImage").hover();
    assert.equal(await carousel.locator("#detailLens").isVisible(), true);
    await carousel.locator("#nextImage").click();
    assert.equal(await carousel.locator("#detailLens").isVisible(), false);
    await carousel.close();

    const mobile = await openAlbum(browser, "player.html", { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const mobileCard = mobile.locator(".gallery .card").first();
    await mobileCard.click();
    const mobileImage = mobile.locator("#detailImage");
    const mobileBox = await mobileImage.boundingBox();
    const tapX = mobileBox.x + mobileBox.width / 2;
    const tapY = mobileBox.y + mobileBox.height / 2;
    await mobile.touchscreen.tap(tapX, tapY);
    await mobile.touchscreen.tap(tapX, tapY);
    assert.equal(await mobileImage.evaluate((element) => element.classList.contains("is-zoomed")), true);
    await mobile.touchscreen.tap(tapX, tapY);
    await mobile.touchscreen.tap(tapX, tapY);
    assert.equal(await mobileImage.evaluate((element) => element.classList.contains("is-zoomed")), false);
    assert.equal(await mobile.locator("#detailLens").isVisible(), false);
    await mobile.close();

    const reduced = await openAlbum(browser, "player.html", { reducedMotion: "reduce" });
    const reducedCard = reduced.locator(".gallery .card").first();
    const reducedBox = await reducedCard.boundingBox();
    await reduced.mouse.move(reducedBox.x + 28, reducedBox.y + 30);
    assert.equal(await reducedCard.evaluate((element) => element.style.getPropertyValue("--glint-x")), "");
    await reducedCard.click();
    await reduced.locator("#detailImage").hover();
    assert.equal(await reduced.locator("#detailLens").isVisible(), false);
    await reduced.close();
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
