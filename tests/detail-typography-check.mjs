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

async function assertDetailFits(page) {
  assert.equal(await page.locator("#detailDialog").evaluate((dialog) => {
    const article = dialog.querySelector("article");
    const caption = dialog.querySelector("#detailCaption");
    const articleBox = article.getBoundingClientRect();
    return dialog.scrollWidth <= dialog.clientWidth + 1 && article.scrollWidth <= article.clientWidth + 1
      && caption.scrollWidth <= caption.clientWidth + 1
      && [...caption.querySelectorAll("p, dt, dd")].every((element) => {
        const box = element.getBoundingClientRect();
        return box.left >= articleBox.left && box.right <= articleBox.right;
      });
  }), true, "detail text and long specification values must fit without horizontal scrolling");
}

async function checkOfficial(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`file://${path.join(root, "index.html")}`);
  await page.locator("#closeIntro").click();
  const articles = await page.evaluate(() => window.BELONGS_CURATED.articles);
  for (const article of articles) {
    await page.locator("#searchInput").fill(article.date);
    for (let index = 0; index < article.works.length; index += 1) {
      const work = article.works[index];
      await page.locator("#gallery .card").nth(index).click();
      const caption = page.locator("#detailCaption");
      assert.equal(await caption.locator(".detail-specs dt").count(), 3, "verified work specifications should have their own aligned section");
      assert.deepEqual(await caption.locator(".detail-specs dt").allTextContents(), ["搭配：", "规格：", "材质："]);
      assert.equal(await caption.textContent(), `${work.description.trim()}\n\n${article.theme.text}`,
        "formatting must preserve every source character, line break and theme");
      assert.equal(await caption.locator(".detail-theme").textContent(), article.theme.text);
      assert.equal(await caption.locator(".detail-theme").count(), 1);
      assert.equal(await caption.evaluate((node) => getComputedStyle(node).fontSize), "16px");
      assert.equal(await caption.evaluate((node) => getComputedStyle(node).lineHeight), "30.4px");
      assert.equal(await page.locator("#detailTitle").evaluate((node) => getComputedStyle(node).borderBottomWidth), "1px");
      assert.match(await page.locator("#detailTitle").evaluate((node) => getComputedStyle(node).fontFamily), /Songti/);
      assert.equal(await page.locator("#detailTitle").evaluate((node) => getComputedStyle(node).fontSize), width <= 680 ? "22px" : "26px");
      if (width <= 680) assert.equal(await page.locator("#detailDialog article").evaluate((node) => getComputedStyle(node).paddingLeft), "22px");
      assert.equal(await page.locator("#detailImage").evaluate((node) => getComputedStyle(node).objectFit), "contain");
      await assertDetailFits(page);
      await page.locator("#closeDialog").click();
    }
  }

  await page.evaluate(() => {
    const group = state.groups.find((candidate) => !candidate.articleId && candidate.caption);
    openDetail(group);
  });
  assert.equal(await page.locator("#detailCaption").textContent(), await page.evaluate(() => state.activeGroup.caption));
  assert.equal(await page.locator("#detailCaption .detail-specs, #detailCaption .detail-theme").count(), 0,
    "legacy captions should not have inferred specifications or themes");
  await page.locator("#closeDialog").click();

  const legacyText = '第一段保留原文。\n\n第二段保留换行。\n材质：这是旧文中的一句话。\n\n<img src=x onerror="window.captionInjected=true">\n——原文结尾，并非已确认主题——';
  await page.evaluate((caption) => openDetail({ ...state.groups[0], caption, articleId: null }), legacyText);
  assert.equal(await page.locator("#detailCaption").textContent(), legacyText);
  assert.equal(await page.locator("#detailCaption .detail-paragraph").count(), 3);
  assert.equal(await page.locator("#detailCaption img, #detailCaption .detail-theme, #detailCaption .detail-specs").count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.captionInjected)), false);
  const paragraphs = await page.locator("#detailCaption .detail-paragraph").evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().toJSON()));
  assert.ok(paragraphs[1].top - paragraphs[0].bottom >= 14, "paragraphs should have visible breathing room");
  await assertDetailFits(page);
  await page.locator("#closeDialog").click();
  await page.evaluate(() => openDetail({ ...state.groups[0], caption: "", articleId: null }));
  assert.equal(await page.locator("#detailCaption").textContent(), "无文字说明");
  assert.equal(await page.locator("#detailCaption .detail-theme").count(), 0, "opening an uncaptioned work must clear the previous theme");
  assert.deepEqual(errors, []);
  console.log(`PASS detail typography, all curated captions, legacy text and safe rendering ${width}px`);
  await page.close();
}

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    for (const width of [1440, 390, 320]) await checkOfficial(browser, width);
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.goto(`file://${path.join(root, "player.html")}`);
    await page.locator("#searchInput").fill("羽翼 #21");
    await page.locator("#gallery .card").click();
    assert.equal(await page.locator("#detailCaption").textContent(), await page.evaluate(() => state.activeGroup.caption));
    assert.equal(await page.locator("#detailCaption .detail-specs, #detailCaption .detail-theme").count(), 0);
    await page.locator("#closeDialog").click();
    await page.locator("#searchInput").fill("");
    await page.locator("#gallery .card").first().click();
    assert.equal(await page.locator("#detailCaption").isHidden(), true);
    assert.equal(await page.locator("#detailCaption").textContent(), "");
    await page.close();
    console.log("PASS player caption compatibility and empty state");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
