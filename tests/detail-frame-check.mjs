import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
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
const screenshotDir = process.env.DETAIL_SCREENSHOT_DIR;

async function checkFrame(dialog, close) {
  const frame = await dialog.evaluate((node) => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return {
      radius: parseFloat(style.borderTopLeftRadius),
      border: style.borderTopWidth,
      borderColor: style.borderTopColor,
      background: style.backgroundColor,
      shadow: style.boxShadow,
      fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
      overflows: node.scrollWidth > node.clientWidth + 1,
    };
  });
  assert.ok(frame.radius > 0 && frame.radius <= 8, "detail frames should have restrained rounded corners");
  assert.equal(frame.border, "1px");
  assert.match(frame.borderColor, /^rgba\(244, 241, 234, 0\.[12]\d*\)$/, "outer border should be quiet against the original palette");
  assert.equal(frame.background, "rgb(244, 241, 234)", "retain the existing paper background");
  assert.notEqual(frame.shadow, "none");
  assert.equal(frame.fits, true, "dialog must fit the viewport");
  assert.equal(frame.overflows, false, "dialog must not scroll horizontally");
  const button = await close.evaluate((node) => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return { width: box.width, height: box.height, border: style.borderTopWidth };
  });
  assert.ok(button.width >= 44 && button.height >= 44, "unframed close control must retain a touch-sized target");
  assert.equal(button.border, "0px", "close control should not show a square frame");
}

async function checkKeyboardClose(page, close) {
  await close.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await close.evaluate((node) => node === document.activeElement && node.matches(":focus-visible")
    && parseFloat(getComputedStyle(node).outlineWidth) >= 2), true, "keyboard users need a visible close-button focus indicator");
  await page.keyboard.press("Enter");
}

async function screenshot(page, name) {
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
}

async function checkPage(browser, filename, viewport) {
  const page = await browser.newPage({
    viewport,
    reducedMotion: "reduce",
    hasTouch: viewport.width <= 860,
    isMobile: viewport.width <= 860,
  });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`file://${path.join(root, filename)}`);
    if (filename === "index.html") {
      await page.locator("#closeIntro").click();
      await page.locator("#searchInput").fill("2026年11月6日");
    } else await page.locator("#searchInput").fill("羽翼 #21");
    await page.locator(filename === "index.html" ? "#gallery .curated-card" : "#gallery .card").first().click();
    const detail = page.locator("#detailDialog");
    const close = page.locator("#closeDialog");
    await page.locator("#detailImage").evaluate((image) => image.decode());
    await checkFrame(detail, close);
    if (viewport.width <= 860) {
      assert.equal(await close.evaluate((button) => button.getBoundingClientRect().bottom
        <= document.querySelector("#detailImage").getBoundingClientRect().top), true,
      "mobile close control must sit above the image without covering it");
    }
    assert.equal(await page.locator("#detailImage").evaluate((image) => getComputedStyle(image).objectFit), "contain");
    await screenshot(page, `${filename}-${viewport.width}x${viewport.height}-detail`);

    if (filename === "index.html") {
      await page.locator("#openArticle").click();
      const article = page.locator("#articleDialog");
      const closeArticle = page.locator("#closeArticle");
      await checkFrame(article, closeArticle);
      await page.locator("#articleDialog img").evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
      await screenshot(page, `${filename}-${viewport.width}x${viewport.height}-article`);
      await article.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      assert.equal(await closeArticle.evaluate((node) => {
        const box = node.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight;
      }), true, "full-article close control must remain reachable after scrolling");
      await checkKeyboardClose(page, closeArticle);
      assert.equal(await article.isVisible(), false);
      assert.equal(await detail.isVisible(), false, "full-article navigation should retain its existing return to the gallery");
      await page.locator("#gallery .curated-card").first().click();
    } else {
      assert.equal(await page.locator("#carouselCount").textContent(), "1 / 2");
      await page.locator("#nextImage").click();
      assert.equal(await page.locator("#carouselCount").textContent(), "2 / 2");
      await page.locator("#prevImage").click();
      assert.equal(await page.locator("#carouselCount").textContent(), "1 / 2");
    }
    if (viewport.width <= 860) {
      await detail.evaluate((dialog) => { dialog.scrollTop = dialog.scrollHeight; });
      assert.equal(await close.evaluate((button) => {
        const box = button.getBoundingClientRect();
        const dialogBox = button.closest("dialog").getBoundingClientRect();
        return box.top >= dialogBox.top && box.bottom <= dialogBox.bottom;
      }), true, "mobile close control must remain reachable while reading the description");
      await close.tap();
    } else await checkKeyboardClose(page, close);
    assert.equal(await detail.isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(`PASS ${filename} detail frame, close and navigation ${viewport.width}x${viewport.height}`);
  } finally {
    await page.close();
  }
}

async function run() {
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 860, height: 700 },
      { width: 861, height: 700 },
      { width: 1440, height: 568 },
    ]) {
      for (const filename of ["index.html", "player.html"]) await checkPage(browser, filename, viewport);
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
