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

async function openPage(browser, filename, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(5000);
  await page.clock.install({ time: new Date("2026-10-22T12:00:00") });
  await page.goto(`file://${path.join(root, filename)}`);
  if (filename.startsWith("index.html")) await page.locator("#closeIntro").click();
  return page;
}

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    const home = await openPage(browser, "index.html");
    assert.equal(await home.locator(".discovery-strip").isVisible(), false);
    const eggTrigger = home.locator("#siteEggTrigger");
    assert.equal(await eggTrigger.isVisible(), true);
    await eggTrigger.click();
    assert.equal(await home.locator("#siteEggDialog").isVisible(), true);
    const daily = home.locator("#dailyPick");
    assert.ok((await daily.locator("strong").textContent()).trim());
    const firstDailyId = await daily.getAttribute("data-discovery-id");
    const firstQuote = await home.locator(".site-egg-quote p").textContent();
    await home.locator(".site-egg-header button").click();
    await eggTrigger.click();
    assert.notEqual(await daily.getAttribute("data-discovery-id"), firstDailyId);
    assert.notEqual(await home.locator(".site-egg-quote p").textContent(), firstQuote);
    assert.match(await home.locator("#timeTraceLabel").textContent(), /往年今日.*10月22日/);
    assert.match(await home.locator("#timeTrace").textContent(), /余生很长，何必慌张/);
    await daily.click();
    assert.equal(await home.locator("#detailDialog").isVisible(), true);
    assert.equal(await home.locator("#siteEggDialog").isVisible(), false);
    await home.locator("#closeDialog").click();
    await home.reload();
    assert.equal(await home.locator("#introDialog").isVisible(), false);
    await home.locator("#siteEggTrigger").click();
    await home.locator("#timeTrace button").first().click();
    assert.equal(await home.locator("#detailDialog").isVisible(), true);
    await home.close();

    const fallback = await browser.newPage();
    fallback.setDefaultTimeout(5000);
    await fallback.clock.install({ time: new Date("2026-10-23T12:00:00") });
    await fallback.goto(`file://${path.join(root, "index.html")}`);
    await fallback.locator("#closeIntro").click();
    await fallback.locator("#siteEggTrigger").click();
    assert.match(await fallback.locator("#timeTraceLabel").textContent(), /十月旧作/);
    assert.ok(await fallback.locator("#timeTrace button").count() > 0);
    await fallback.close();

    const filtered = await openPage(browser, "index.html?q=%E7%BE%BD%E7%BF%BC");
    assert.equal(await filtered.locator("#searchInput").inputValue(), "羽翼");
    const visible = Number(await filtered.locator("#visibleCount").textContent());
    const total = Number(await filtered.locator("#totalCount").textContent());
    assert.ok(visible > 0 && visible < total);
    await filtered.close();

    const story = await openPage(browser, "brand-story.html");
    const motif = story.locator(".motif-links a", { hasText: "羽翼" });
    assert.equal(await motif.getAttribute("href"), "index.html?q=%E7%BE%BD%E7%BF%BC");
    await motif.click();
    await story.waitForURL(/index\.html\?q=/);
    await story.locator("#closeIntro").click();
    assert.equal(await story.locator("#searchInput").inputValue(), "羽翼");
    await story.close();

    for (const filename of ["index.html", "player.html", "brand-story.html"]) {
      const page = await openPage(browser, filename, { width: 390, height: 844 });
      const brandInfo = page.locator(".brand-public-info");
      assert.match(await brandInfo.textContent(), /小红书号：BELONGS/);
      assert.match(await brandInfo.textContent(), /微信公众号：BELONGS OFFICIAL/);
      const trigger = page.locator("#siteEggTrigger");
      assert.equal(await trigger.count(), 1);
      assert.equal(await page.locator(".site-nav > #siteEggTrigger").count(), 1);
      await trigger.click();
      const egg = page.locator("#siteEggDialog");
      assert.equal(await egg.isVisible(), true);
      assert.match(await egg.textContent(), /官方图文《.+》 · 20\d{2}/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.close();
    }

    for (const [randomValue, expectedIndex] of [[0, 0], [0.99, 3]]) {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.addInitScript((value) => { Math.random = () => value; }, randomValue);
      await page.goto(`file://${path.join(root, "brand-story.html")}`);
      assert.equal(await page.locator(".site-nav > *").evaluateAll((children) => children.findIndex((child) => child.id === "siteEggTrigger")), expectedIndex);
      await page.close();
    }

    const narrow = await openPage(browser, "index.html", { width: 320, height: 720 });
    await narrow.locator("#siteEggTrigger").click();
    assert.equal(await narrow.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok((await narrow.locator("#timeTrace button").first().boundingBox()).width > 170);
    await narrow.close();
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
