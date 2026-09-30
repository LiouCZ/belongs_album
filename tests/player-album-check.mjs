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
const defaultChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || defaultChromePath,
  });

  try {
    await assertHomeLinksToPlayerAlbum(browser);
    await assertPlayerAlbumRendersWingGallery(browser);
  } finally {
    await browser.close();
  }
}

async function assertHomeLinksToPlayerAlbum(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = await collectPageErrors(page);

  await page.goto(`file://${path.join(root, "index.html")}`);

  const officialLink = page.getByRole("link", { name: "官方画册" });
  const playerLink = page.getByRole("link", { name: "玩家分享" });
  await expectVisible(officialLink, "official album nav link should be visible");
  await expectVisible(playerLink, "player album nav link should be visible");
  assert.equal(await playerLink.getAttribute("href"), "player.html");
  assert.deepEqual(errors, []);

  await page.close();
}

async function assertPlayerAlbumRendersWingGallery(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = await collectPageErrors(page);

  await page.goto(`file://${path.join(root, "player.html")}`);

  assert.equal(await page.locator("h1").textContent(), "Belongs 玩家分享画册");
  await expectVisible(page.getByRole("link", { name: "官方画册" }), "official album nav link should be visible");
  await expectVisible(page.getByRole("link", { name: "玩家分享" }), "player album nav link should be visible");
  await expectVisible(page.getByRole("searchbox"), "search input should remain available");
  await expectVisible(page.getByRole("button", { name: "羽翼合集" }), "wing collection filter should be visible");
  assert.equal(await page.locator("#collectionFilter .chip").count(), 2);
  assert.equal(await page.locator("#totalCount").textContent(), "30");
  assert.equal(await page.locator("#visibleCount").textContent(), "30");
  assert.match(await page.locator("#summaryText").textContent(), /找到 30 组图文，39 张图片/);
  assert.equal(await page.locator("#emptyState").isHidden(), true);
  assert.equal(await page.locator(".card").count(), 20);
  const thumbBox = await page.locator(".thumb").first().boundingBox();
  assert.ok(Math.abs(thumbBox.width / thumbBox.height - 4 / 3) < 0.02, "gallery image frame should use a 4:3 ratio");

  const dimensions = await page.evaluate(() => window.BELONGS_DATA.items.map((item) => [item.width, item.height, item.thumbWidth, item.thumbHeight]));
  assert.equal(dimensions.every(([width, height, thumbWidth, thumbHeight]) => width === 1200 && height === 900 && thumbWidth === 360 && thumbHeight === 270), true);
  const loadedDimensions = await page.evaluate(async () => {
    return Promise.all(window.BELONGS_DATA.items.map((item) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
      image.onerror = () => resolve([0, 0]);
      image.src = item.image;
    })));
  });
  assert.equal(loadedDimensions.every(([width, height]) => width === 1200 && height === 900), true);

  await page.getByRole("button", { name: "羽翼合集" }).click();
  assert.equal(await page.locator("#visibleCount").textContent(), "30");
  assert.match(await page.locator("#summaryText").textContent(), /羽翼合集/);

  await page.getByRole("searchbox").fill("羽翼 #21");
  assert.equal(await page.locator("#visibleCount").textContent(), "1");
  assert.equal(await page.locator(".card").count(), 1);
  assert.equal(await page.locator(".image-count").textContent(), "2 张");

  await page.locator(".card").click();
  await expectVisible(page.locator("#carouselControls"), "wing 21 carousel should be visible");
  assert.equal(await page.locator("#carouselCount").textContent(), "1 / 2");
  await page.locator("#nextImage").click();
  assert.equal(await page.locator("#carouselCount").textContent(), "2 / 2");
  await page.locator("#closeDialog").click();
  assert.deepEqual(errors, []);

  await page.close();
}

async function expectVisible(locator, message) {
  assert.equal(await locator.count(), 1, message);
  assert.equal(await locator.isVisible(), true, message);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
