import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"))
  : createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

async function open(width = 1440, query = "", fixtures = false) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (fixtures === "regular-only") {
    const curated = JSON.parse(readFileSync(path.join(root, "data/curated-official.json"), "utf8"));
    curated.items = curated.items.filter((item) => item.releaseType !== "invited");
    await page.addInitScript((value) => {
      Object.defineProperty(window, "BELONGS_CURATED", { value, writable: false });
    }, curated);
  } else if (fixtures) {
    await page.addInitScript(() => {
      const item = (id, date, releaseType, sourceIndex) => ({
        id, year: date.slice(0, 4), date, releaseType, sourceIndex, index: sourceIndex,
        title: "S十字", caption: "固定造型独立雕刻\n金沙漏\n材质：S925",
        image: "assets/intro/serpent.png", thumb: "assets/intro/serpent.png",
        thumbWidth: 820, thumbHeight: 1066,
      });
      Object.defineProperty(window, "BELONGS_DATA", { value: { items: [
        item("regular-same", "2026年1月2日", "regular", 1),
        ...Array.from({ length: 21 }, (_, i) => item(`old-${i}`, "2025年1月1日", undefined, i + 2)),
        item("invite-later", "2026年1月3日", "invited", 24),
        item("invite-same", "2026年1月2日", "invited", 25),
      ] }, writable: false });
      Object.defineProperty(window, "BELONGS_CURATED", { value: { articles: [], items: [] }, writable: false });
    });
  }
  await page.goto(`file://${path.join(root, "index.html")}${query}`);
  await page.locator("#closeIntro").click();
  return { page, errors };
}

async function assertLayout(page) {
  assert.equal(await page.evaluate(() => {
    const nav = document.querySelector("#releaseNav").getBoundingClientRect();
    const links = [...document.querySelectorAll("#releaseNav a")].map((node) => node.getBoundingClientRect());
    const results = document.querySelector(".results-bar").getBoundingClientRect();
    return document.documentElement.scrollWidth <= innerWidth
      && links.every((box) => box.width > 0 && box.left >= 0 && box.right <= innerWidth)
      && links[0].right <= links[1].left
      && nav.bottom <= results.top;
  }), true, "section navigation must fit without overlaps in either view");
}

try {
  for (const width of [1440, 768, 390, 320]) {
    for (const view of ["grid", "list"]) {
      const { page, errors } = await open(width, view === "list" ? "?view=list" : "", "regular-only");
      const regular = page.locator('[data-release-type="regular"]');
      const invited = page.locator('[data-release-type="invited"]');
      assert.equal(await regular.isVisible(), true, "official album needs a release-section navigation");
      assert.equal(await regular.getAttribute("aria-current"), "page");
      const total = Number(await page.locator("#totalCount").textContent());
      assert.ok(total > 700, "all existing work must remain in regular releases");
      assert.equal(Number(await page.locator("#visibleCount").textContent()), total);
      await assertLayout(page);
      await page.locator("#nextPage").click();
      await invited.click();
      assert.equal(new URL(page.url()).searchParams.get("release"), "invited");
      assert.equal(await invited.getAttribute("aria-current"), "page");
      assert.equal(await page.locator("#gallery .card").count(), 0);
      assert.equal(await page.locator("#totalCount").textContent(), "0");
      assert.equal(await page.locator("#emptyState").isVisible(), true);
      assert.match(await page.locator("#emptyState h2").textContent(), /邀约作品尚未收录/);
      assert.equal(await page.locator("#emptyState p").isHidden(), true);
      assert.equal(await page.locator("#pagination").isHidden(), true);
      assert.deepEqual(await page.locator("#yearFilter option").evaluateAll((options) => options.map((node) => node.value)), ["all"]);
      assert.equal(await page.locator("#categorySelect option").count(), 1);
      await assertLayout(page);
      if (process.env.RELEASE_SCREENSHOT_DIR) {
        mkdirSync(process.env.RELEASE_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.RELEASE_SCREENSHOT_DIR, `invited-${width}-${view}.png`) });
      }
      await regular.click();
      assert.equal(await page.locator("#gallery .card").count(), 20);
      assert.match(await page.locator("#pageInfo").textContent(), /第 1 \/ /);
      assert.equal(Number(await page.locator("#totalCount").textContent()), total);
      if (process.env.RELEASE_SCREENSHOT_DIR) {
        await page.screenshot({ path: path.join(process.env.RELEASE_SCREENSHOT_DIR, `regular-${width}-${view}.png`) });
      }
      await page.goBack();
      assert.equal(await invited.getAttribute("aria-current"), "page");
      await page.reload();
      assert.equal(await invited.getAttribute("aria-current"), "page");
      assert.equal(await page.locator(`#viewSwitch [data-view="${view}"]`).getAttribute("aria-pressed"), "true");
      await invited.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Enter");
      assert.equal(await regular.getAttribute("aria-current"), "page");
      assert.equal(await page.evaluate(() => document.activeElement.matches('[data-release-type="regular"]')), true);
      assert.deepEqual(errors, []);
      console.log(`PASS existing album and empty invitation section ${width}px ${view}`);
      await page.close();
    }
  }

  const { page, errors } = await open(1440, "", true);
  assert.equal(await page.locator("#totalCount").textContent(), "2", "21 same-description historical images remain grouped");
  await page.locator("#yearFilter").selectOption("2025");
  await page.locator("#categorySelect").selectOption("S十字");
  await page.locator('[data-release-type="invited"]').click();
  assert.equal(await page.locator("#yearFilter").inputValue(), "all", "invalid year must reset on section switch");
  assert.equal(await page.locator("#categorySelect").inputValue(), "S十字", "valid categories should be retained");
  assert.equal(await page.locator("#totalCount").textContent(), "2");
  assert.deepEqual(await page.locator("#gallery .meta").allTextContents(), ["2026年1月2日 · 2026", "2026年1月3日 · 2026"]);
  assert.equal(await page.locator("#gallery .image-count").count(), 0, "same-description regular and invited work must not merge");
  await page.locator("#searchInput").fill("2026年1月2日");
  assert.equal(await page.locator("#visibleCount").textContent(), "1");
  await page.locator("#gallery .card").click();
  assert.match(await page.locator("#detailMeta").textContent(), /邀约作品/);
  await page.locator("#closeDialog").click();
  await page.locator('#viewSwitch [data-view="list"]').click();
  assert.equal(new URL(page.url()).searchParams.get("release"), "invited");
  assert.equal(await page.locator("#gallery .card-list").count(), 1);
  await page.reload();
  assert.equal(await page.locator('[data-release-type="invited"]').getAttribute("aria-current"), "page");
  await page.locator("#searchInput").fill("not-found");
  assert.match(await page.locator("#emptyState h2").textContent(), /没有找到/);
  assert.equal(await page.locator("#emptyState p").isVisible(), true);
  assert.deepEqual(errors, []);
  await page.close();

  const invalid = await open(390, "?release=unknown&view=list");
  assert.equal(await invalid.page.locator('[data-release-type="regular"]').getAttribute("aria-current"), "page");
  await invalid.page.close();
  const player = await browser.newPage();
  await player.goto(`file://${path.join(root, "player.html")}`);
  assert.equal(await player.locator("#releaseNav").count(), 0);
  assert.equal(await player.locator("#visibleCount").textContent(), "30");
  await player.close();
  console.log("PASS invitation data, scoped filters, chronology, details, links and player compatibility");
} finally {
  await browser.close();
}
