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

async function assertPaginationFits(page) {
  assert.equal(await page.evaluate(() => {
    const navigation = document.querySelector("#pagination").getBoundingClientRect();
    const buttons = [...document.querySelectorAll("#pagination button")]
      .map((button) => button.getBoundingClientRect());
    const info = document.querySelector("#pageInfo").getBoundingClientRect();
    return document.documentElement.scrollWidth <= innerWidth
      && info.left >= navigation.left - 1 && info.right <= navigation.right + 1
      && buttons.every((button) => button.left >= navigation.left - 1 && button.right <= navigation.right + 1)
      && buttons.every((button, index) => buttons.slice(index + 1).every((other) =>
        button.right <= other.left || other.right <= button.left
        || button.bottom <= other.top || other.bottom <= button.top));
  }), true, "pagination controls should fit without overlapping");
}

async function checkPage(browser, file, width, view = "grid") {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`file://${path.join(root, file)}${view === "list" ? "?view=list" : ""}`);
  if (file === "index.html") await page.locator("#closeIntro").click();

  assert.equal(await page.locator("#firstPage").isDisabled(), true);
  assert.equal(await page.locator("#prevPage").isDisabled(), true);
  for (const [id, label] of [["firstPage", "第一页"], ["prevPage", "上一页"], ["nextPage", "下一页"], ["lastPage", "最后一页"]]) {
    const button = page.getByRole("button", { name: label, exact: true });
    assert.equal(await button.getAttribute("id"), id);
    assert.equal(await button.locator('svg[aria-hidden="true"]').count(), 1, "page navigation should use compact icons");
    assert.equal(await button.getAttribute("title"), label);
    const box = await button.boundingBox();
    assert.equal(box.width, box.height, "page navigation icons should have square hit areas");
    assert.ok(box.width >= 36);
  }
  assert.equal(await page.locator('#pageNumbers [aria-current="page"]').textContent(), "1");
  assert.equal(await page.locator("#pageNumbers [data-page]").count() > 1, true);
  await page.keyboard.press("Tab");
  await page.locator('#pageNumbers [data-page="2"]').focus();
  assert.equal(await page.locator('#pageNumbers [data-page="2"]').evaluate((button) =>
    getComputedStyle(button).outlineStyle !== "none"), true, "keyboard page selection needs a visible focus state");
  if (width <= 680) {
    assert.ok((await page.locator("#pagination").boundingBox()).height <= 104, "mobile pagination should use no more than two compact rows");
  }
  await assertPaginationFits(page);
  if (process.env.PAGINATION_SCREENSHOT_DIR) {
    await page.locator("#pagination").screenshot({
      path: path.join(process.env.PAGINATION_SCREENSHOT_DIR, `first-${file}-${width}-${view}.png`),
    });
  }

  const firstCardId = await page.locator("#gallery .card").first().getAttribute("data-id");
  await page.locator('#pageNumbers [data-page="2"]').click();
  assert.match(await page.locator("#pageInfo").textContent(), /第 2 \/ /);
  assert.equal(await page.locator("#firstPage").isEnabled(), true);
  assert.equal(await page.locator('#pageNumbers [aria-current="page"]').textContent(), "2");
  assert.notEqual(await page.locator("#gallery .card").first().getAttribute("data-id"), firstCardId);

  if (file === "index.html") {
    await page.locator('#pageNumbers [data-page="4"]').click();
    assert.equal(await page.locator("#pageNumbers [data-page]").count(), 5);
    assert.equal(await page.locator("#pageNumbers .page-gap").count(), 2);
    await assertPaginationFits(page);
  }
  if (process.env.PAGINATION_SCREENSHOT_DIR) {
    await page.locator("#pagination").screenshot({
      path: path.join(process.env.PAGINATION_SCREENSHOT_DIR, `${file}-${width}-${view}.png`),
    });
  }

  await page.locator("#firstPage").click();
  await page.locator("#lastPage").click();
  assert.equal(await page.locator("#nextPage").isDisabled(), true);
  assert.equal(await page.locator("#lastPage").isDisabled(), true);
  assert.equal(await page.locator('#pageNumbers [aria-current="page"]').textContent(),
    (await page.locator("#pageInfo").textContent()).match(/\/ (\d+) 页/)[1]);
  await assertPaginationFits(page);
  if (process.env.PAGINATION_SCREENSHOT_DIR) {
    await page.locator("#pagination").screenshot({
      path: path.join(process.env.PAGINATION_SCREENSHOT_DIR, `last-${file}-${width}-${view}.png`),
    });
  }
  await page.locator("#prevPage").click();
  assert.equal(await page.locator("#nextPage").isEnabled(), true);
  await page.locator("#nextPage").click();
  assert.equal(await page.locator("#nextPage").isDisabled(), true);

  await page.locator("#firstPage").click();
  assert.equal(await page.locator('#pageNumbers [aria-current="page"]').textContent(), "1");
  assert.equal(await page.locator("#gallery .card").first().getAttribute("data-id"), firstCardId);
  await page.locator("#nextPage").click();
  await page.locator("#pageSizeSelect").selectOption("25");
  assert.equal(await page.locator('#pageNumbers [aria-current="page"]').textContent(), "1");
  await page.locator("#nextPage").click();
  await page.locator("#searchInput").fill(file === "index.html" ? "2026年9月11日" : "羽翼 #21");
  assert.equal(await page.locator("#pageNumbers [data-page]").count(), 1);
  assert.equal(await page.locator("#lastPage").isDisabled(), true);
  assert.equal(await page.locator('#pageNumbers [aria-current="page"]').textContent(), "1");
  await assertPaginationFits(page);
  await page.locator("#searchInput").fill("no-matching-album-entry");
  assert.equal(await page.locator("#pagination").isHidden(), true);
  assert.equal(await page.locator("#emptyState").isVisible(), true);
  assert.deepEqual(errors, []);
  console.log(`PASS ${file} ${width}px ${view}`);
  await page.close();
}

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    await checkPage(browser, "index.html", 1440);
    await checkPage(browser, "index.html", 768);
    await checkPage(browser, "index.html", 390);
    await checkPage(browser, "index.html", 320);
    await checkPage(browser, "index.html", 1440, "list");
    await checkPage(browser, "index.html", 320, "list");
    await checkPage(browser, "player.html", 390);
    await checkPage(browser, "player.html", 320);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
