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

async function openHome(browser, query = "", viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(5000);
  await page.goto(`file://${path.join(root, "index.html")}${query}`);
  await page.locator("#closeIntro").click();
  return page;
}

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    const home = await openHome(browser);
    assert.equal(await home.locator("#viewSwitch").isVisible(), true);
    assert.equal(await home.locator("#viewSwitch [data-view='grid']").getAttribute("aria-pressed"), "true");
    assert.equal(await home.locator(".gallery .card-list").count(), 0);
    const firstId = await home.locator(".gallery .card").first().getAttribute("data-id");

    await home.locator("#viewSwitch [data-view='list']").click();
    assert.equal(new URL(home.url()).searchParams.get("view"), "list");
    assert.equal(await home.locator("#viewSwitch [data-view='list']").getAttribute("aria-pressed"), "true");
    assert.equal(await home.locator(".gallery .card-list").count(), 20);
    assert.equal(await home.locator(".gallery .card").first().getAttribute("data-id"), firstId);
    await home.locator(".gallery .card").first().click();
    assert.equal(await home.locator("#detailDialog").isVisible(), true);
    await home.locator("#closeDialog").click();

    await home.locator("#searchInput").fill("羽翼");
    const filteredCount = Number(await home.locator("#visibleCount").textContent());
    assert.ok(filteredCount > 0 && filteredCount < 729);
    assert.ok(await home.locator(".gallery .card-list").count() > 0);
    await home.reload();
    await home.locator("#closeIntro").click();
    assert.equal(await home.locator(".gallery .card-list").count(), 20);

    await home.locator("#yearFilter [data-year='2021']").click();
    await home.locator("#pageSizeSelect").selectOption("25");
    assert.equal(await home.locator(".gallery .card-list").count(), 25);
    const pageOneId = await home.locator(".gallery .card").first().getAttribute("data-id");
    await home.locator("#nextPage").click();
    assert.notEqual(await home.locator(".gallery .card").first().getAttribute("data-id"), pageOneId);

    await home.locator("#viewSwitch [data-view='grid']").click();
    assert.equal(new URL(home.url()).searchParams.has("view"), false);
    assert.equal(await home.locator(".gallery .card-list").count(), 0);
    assert.equal(await home.locator(".gallery .card").count(), 25);
    assert.match(await home.locator("#pageInfo").textContent(), /第 2 \/ /);
    await home.goBack();
    assert.equal(await home.locator("#viewSwitch [data-view='list']").getAttribute("aria-pressed"), "true");
    assert.equal(await home.locator(".gallery .card-list").count(), 25);
    await home.close();

    const direct = await openHome(browser, "?q=%E7%BE%BD%E7%BF%BC&view=list");
    assert.equal(await direct.locator("#searchInput").inputValue(), "羽翼");
    assert.equal(await direct.locator(".gallery .card-list").count() > 0, true);
    await direct.locator("#viewSwitch [data-view='grid']").click();
    assert.equal(new URL(direct.url()).searchParams.get("q"), "羽翼");
    await direct.close();

    for (const width of [320, 390, 1440]) {
      const page = await openHome(browser, "?view=list", { width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator(".gallery .card-list").count(), 20);
      if (width <= 390) assert.ok((await page.locator(".gallery img").first().boundingBox()).y < 600);
      await page.close();
    }

    const player = await browser.newPage();
    await player.goto(`file://${path.join(root, "player.html")}`);
    assert.equal(await player.locator("#viewSwitch").count(), 0);
    assert.equal(await player.locator(".gallery .card-list").count(), 0);
    await player.close();
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
