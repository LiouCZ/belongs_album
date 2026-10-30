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
    await assertPlayerControlsResponsive(browser);
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
  await expectVisible(page.locator("#collectionSpotlight"), "collection overview should be visible");
  assert.equal(await page.locator("#collectionTitle").textContent(), "羽翼合集");
  assert.equal(await page.locator("#collectionCount").textContent(), "30 组作品 · 39 张图片");
  await expectVisible(page.getByRole("button", { name: "羽翼合集" }), "wing collection filter should be visible");
  assert.equal(await page.locator("#collectionFilter .chip").count(), 1);
  assert.equal(await page.locator("#collectionFilter .chip").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#yearFilter").count(), 0);
  assert.equal(await page.locator("#totalCount").textContent(), "30");
  assert.equal(await page.locator("#visibleCount").textContent(), "30");
  assert.match(await page.locator("#summaryText").textContent(), /找到 30 组图文，39 张图片/);
  assert.doesNotMatch(await page.locator("#summaryText").textContent(), /未标注/);
  assert.equal(await page.locator("#emptyState").isHidden(), true);
  assert.equal(await page.locator(".player-card").count(), 20);
  assert.equal(await page.locator(".player-card .excerpt").count(), 0);
  assert.equal(await page.locator(".player-card").first().evaluate((card) =>
    getComputedStyle(card).borderRadius), "8px", "player cards should have soft corners");
  assert.equal(await page.locator(".player-card").first().evaluate((card) =>
    getComputedStyle(card).overflow), "hidden", "images should follow the card corners");
  assert.equal(await page.locator(".player-card .thumb img").first().evaluate((image) =>
    getComputedStyle(image).objectFit), "contain", "rounding the card must not crop the photograph");
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

  await page.locator(".player-card").first().click();
  assert.equal(await page.locator("#detailMeta").textContent(), "羽翼合集");
  assert.equal(await page.locator("#detailCaption").isHidden(), true);
  await page.locator("#closeDialog").click();

  await page.getByRole("searchbox").fill("羽翼 #21");
  assert.equal(await page.locator("#visibleCount").textContent(), "1");
  assert.equal(await page.locator(".player-card").count(), 1);
  assert.equal(await page.locator(".image-count").textContent(), "2 张");

  await page.locator(".player-card").click();
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

async function assertPlayerControlsResponsive(browser) {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(5000);
    const errors = await collectPageErrors(page);
    await page.goto(`file://${path.join(root, "player.html")}`);
    const search = page.getByRole("searchbox");
    const select = page.getByRole("combobox", { name: "每页显示数量" });
    assert.equal(await page.locator("#collectionSpotlight").evaluate((node) => getComputedStyle(node).backgroundColor),
      await page.locator(".player-card .card-body").first().evaluate((node) => getComputedStyle(node).backgroundColor),
      "collection introduction should match the card background");
    for (const control of [search, select]) {
      assert.equal(await control.evaluate((node) => getComputedStyle(node).borderRadius), "4px");
      assert.equal(await control.evaluate((node) => getComputedStyle(node).backgroundColor), "rgb(244, 241, 234)", "keep the original paper-colored controls");
      assert.equal(await control.evaluate((node) => getComputedStyle(node).color), "rgb(17, 19, 21)", "keep the original ink color");
      assert.equal((await control.boundingBox()).height, 44, "player controls should align at a compact height");
    }
    if (await page.evaluate(() => CSS.supports("appearance", "base-select"))) {
      await select.click();
      await select.locator('option[value="25"]').click();
      assert.equal(await select.evaluate((node) => node.matches(":open")), false);
      assert.equal(await select.locator("selectedcontent").textContent(), "25 组");
    } else {
      await select.selectOption("25");
    }
    assert.equal(await page.locator(".player-card").count(), 25);
    await search.fill("羽翼 #21");
    assert.equal(await page.locator(".player-card").count(), 1);
    assert.equal(await select.inputValue(), "25");
    assert.equal(await page.evaluate(() => {
      const controls = [...document.querySelectorAll(".controls input, .controls select")].map((node) => node.getBoundingClientRect());
      return document.documentElement.scrollWidth <= innerWidth && controls.every((box) => box.left >= 0 && box.right <= innerWidth)
        && controls[0].right <= controls[1].left;
    }), true, "player controls should fit without overlap");
    assert.deepEqual(errors, []);
    console.log(`PASS player controls and selection ${width}px`);
    await page.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
