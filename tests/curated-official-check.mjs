import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const playwrightRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"))
  : require;
const { chromium } = playwrightRequire("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceArticles = [
  ["3E-K4wxH146_V9z49av25A", "2026-07-10", "——休息 调整——", 13],
  ["DdwT0oJaKUtboMoAnPo6Ng", "2026-09-11", "——周五依旧——", 7],
  ["zAgTUUI6DRLU7rFtnm-LSg", "2026-09-25", "——月圆人圆 万事皆甜——", 8],
  ["nPVJ0e54hqny1x9BH473mw", "2026-10-09", "——感受留白的温柔——", 7],
  ["afUnYP9DPfBYOcFBT6-XCg", "2026-10-23", "——被温暖环绕——", 7],
];
const chromePath = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`file://${path.join(root, "index.html")}`);
      await page.locator("#closeIntro").click();
      for (const [slug, date, theme, workCount] of sourceArticles) {
        const article = JSON.parse(readFileSync(path.resolve(root, `../album_source/articles/${slug}.json`), "utf8"));
        assert.equal(article.theme.date, date);
        assert.equal(article.theme.text, theme);
        const displayDate = `${Number(date.slice(0, 4))}年${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
        await page.locator("#searchInput").fill(displayDate);
        assert.equal(await page.locator(".gallery .card").count(), workCount);
        if (slug === "3E-K4wxH146_V9z49av25A") {
          assert.deepEqual(await page.locator(".gallery .card h3").allTextContents(),
            ["符节戒指", "羽翼戒指", "蛇骨链", "莫比乌斯手镯", "平打手镯", "S十字", "M十字", "狗牌", "马首", "初心羽", "羽翼", "Mini十字狗牌", "包扣"]);
        }
        if (slug === "DdwT0oJaKUtboMoAnPo6Ng") {
          assert.deepEqual(await page.locator(".gallery .card h3").allTextContents(),
            ["马首", "合心牌", "合心牌", "合心牌", "合心牌", "初心羽", "雏翼戒指"]);
        }
        await page.locator(".gallery .card").first().click();
        assert.equal((await page.locator("#detailCaption").textContent()).trim().endsWith(theme), true);
        assert.equal(await page.locator("#openArticle").isVisible(), true);
        await page.locator("#openArticle").click();
        assert.equal(await page.locator("#articleDialog").isVisible(), true);
        assert.equal(await page.locator("#articleDialog .article-work").count(), workCount);
        assert.equal(await page.locator("#articleDialog .article-work img").count(), workCount);
        await page.waitForFunction(() => [...document.querySelectorAll("#articleDialog .article-work img")].every((image) => image.complete && image.naturalWidth > 0));
        assert.equal(await page.locator("#articleDialog .article-theme-text").textContent(), theme);
        assert.match(await page.locator("#articleDialog .article-theme-date").textContent(), new RegExp(displayDate));
        assert.equal((await page.locator("#articleDialog .article-work figcaption").allTextContents()).some((text) => text.includes(theme)), false);
        assert.equal(await page.locator("#articleDialog input, #articleDialog textarea, #articleDialog [contenteditable]").count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.locator("#articleDialog").evaluate((dialog) => dialog.close());
        await page.locator("#detailDialog").evaluate((dialog) => dialog.close());
      }
      await page.locator("#searchInput").fill("");
      await page.getByRole("combobox", { name: "年份筛选" }).selectOption("2026");
      await page.locator("#pageSizeSelect").selectOption("100");
      const expectedDates = [
        ...Array(13).fill("2026年7月10日"),
        ...Array(7).fill("2026年9月11日"),
        ...Array(8).fill("2026年9月25日"),
        ...Array(7).fill("2026年10月9日"),
        ...Array(7).fill("2026年10月23日"),
      ];
      for (const view of ["grid", "list"]) {
        await page.locator(`#viewSwitch [data-view="${view}"]`).click();
        const dates = await page.locator(".gallery .card .meta").allTextContents();
        const curatedDates = await page.locator(".gallery .curated-card .meta").allTextContents();
        if (await page.locator("#nextPage").isEnabled()) {
          await page.locator("#nextPage").click();
          dates.push(...await page.locator(".gallery .card .meta").allTextContents());
          curatedDates.push(...await page.locator(".gallery .curated-card .meta").allTextContents());
          await page.locator("#prevPage").click();
        }
        assert.match(dates[0], /2026年1月9日/);
        assert.match(dates[1], /2026/);
        assert.deepEqual(curatedDates.map((text) => text.match(/\d{4}年\d{1,2}月\d{1,2}日/)?.[0]), expectedDates);
        const june = dates.findIndex((text) => text.includes("2026年6月26日"));
        const july = dates.findIndex((text) => text.includes("2026年7月10日"));
        const september = dates.findIndex((text) => text.includes("2026年9月11日"));
        assert.ok(june >= 0 && june < july && july < september);
      }
      await page.getByRole("combobox", { name: "年份筛选" }).selectOption("2021");
      assert.match(await page.locator(".gallery .card .meta").first().textContent(), /2021年4月16日/);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
