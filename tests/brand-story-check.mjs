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
const expected = [
  ["DENHAM x Belongs 🪙合作上线", "6623989f000000000100732f"],
  ["DENHAM FRIENDS | 探访BELONGS Part1", "69e9fcbf0000000023006261"],
  ["DENHAM FRIENDS | 探访BELONGS Part 2", "69eb17ca000000001e00c1d0"],
  ["DENHAM FRIENDS | 探访BELONGS Part 3", "69eb1842000000002003aa3c"],
];
const themes = ["手作与原创", "自然与复古美学", "形与象征", "时间与情感"];

async function assertWhitespaceOrnaments(page, viewport) {
  const ornaments = page.locator(".story-ornament");
  assert.equal(await ornaments.count(), 2, "the opening should include snake-bone and grape-leaf details");
  await page.waitForFunction(() => [...document.querySelectorAll(".story-ornament")].every((element) => element.dataset.ornamentState === "ready"));
  for (const ornament of await ornaments.all()) {
    assert.equal(await ornament.evaluate((element) => {
      const canvas = element.querySelector("canvas");
      return canvas?.width > 0 && canvas?.height > 0;
    }), true, "both decorative assets must load and render");
  }
  const boxes = await ornaments.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, display: style.display, pointerEvents: style.pointerEvents, hidden: element.getAttribute("aria-hidden") };
  }));
  const introduction = await page.locator(".philosophy-introduction").boundingBox();
  const illustration = await page.locator(".brand-illustration").boundingBox();
  for (const ornament of boxes) {
    assert.equal(ornament.pointerEvents, "none", "decorations must not intercept mouse or touch interactions");
    assert.equal(ornament.hidden, "true", "decorations should stay out of the reading order");
    if (ornament.display !== "none") assert.ok(ornament.left >= 0 && ornament.right <= viewport.width, "decorations should stay within the viewport");
  }
  if (viewport.width < 1024) {
    assert.ok(boxes[0].top >= introduction.y + introduction.height + 10, "the mobile ornament should not overlap the introduction");
    assert.ok(boxes[0].bottom <= illustration.y - 10, "the mobile ornament should not overlap the portrait");
    const chapters = await page.locator(".philosophy-chapters").boundingBox();
    assert.ok(boxes[1].top >= illustration.y + illustration.height + 8, "the mobile leaves should sit below the portrait");
    assert.ok(boxes[1].bottom <= chapters.y - 8, "the mobile leaves should stay clear of the next chapter");
  }
}

async function assertImageFrames(page) {
  const standaloneImages = await page.locator(".brand-illustration img, .philosophy-chapter img").evaluateAll((images) =>
    images.map((image) => {
      const style = getComputedStyle(image);
      return {
        radius: style.borderRadius,
        outline: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineOffset: style.outlineOffset,
        outlineColor: style.outlineColor,
        borderWidth: style.borderTopWidth,
      };
    }));
  assert.equal(standaloneImages.length, 5);
  for (const image of standaloneImages) {
    assert.equal(image.radius, "8px", "standalone story images should have soft corners");
    assert.equal(image.outline, "solid", "standalone story images need a subtle frame");
    assert.equal(image.outlineWidth, "1px");
    assert.equal(image.outlineOffset, "-1px", "image frames should stay inside the original image bounds");
    assert.equal(image.outlineColor, "rgba(244, 241, 234, 0.35)");
    assert.equal(image.borderWidth, "0px", "frames must not shrink the photograph or change its layout");
  }
  const cards = await page.locator(".story-feature, .story-entry, .story-card").evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return { radius: style.borderRadius, overflow: style.overflow, background: style.backgroundColor, border: style.borderTopWidth };
    }));
  assert.ok(cards.length > 0);
  for (const card of cards) {
    assert.equal(card.radius, "8px", "story cards should share the album corner treatment");
    assert.equal(card.overflow, "hidden", "card images must follow the rounded outer frame");
    assert.equal(card.border, "1px", "retain the existing card border");
    assert.equal(card.background, "rgb(244, 241, 234)", "retain the original paper-colored cards");
  }
  assert.equal(await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor), "rgb(95, 105, 107)");
  assert.equal(await page.locator(".story-feature-image img, .story-entry-media img, .story-media img, .brand-logo").evaluateAll((images) =>
    images.every((image) => {
      const style = getComputedStyle(image);
      return style.borderTopWidth === "0px" && style.outlineStyle === "none";
    })), true, "card photos and the transparent logo should not get a second frame");
}

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    for (const pageName of ["index.html", "player.html"]) {
      const page = await browser.newPage();
      await page.goto(`file://${path.join(root, pageName)}`);
      assert.equal(await page.getByRole("link", { name: "品牌故事" }).getAttribute("href"), "brand-story.html");
      await page.close();
    }

    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 900 }, { width: 1024, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
      const page = await browser.newPage({ viewport });
      await page.goto(`file://${path.join(root, "brand-story.html")}`);
      assert.equal(await page.locator("h1").textContent(), "品牌故事");
      await assertImageFrames(page);
      await assertWhitespaceOrnaments(page, viewport);
      const philosophy = page.getByRole("region", { name: "创作理念" });
      assert.equal(await philosophy.locator(".philosophy-chapter").count(), themes.length);
      const illustration = philosophy.locator(".brand-illustration");
      assert.equal(await illustration.count(), 1);
      assert.equal(await illustration.locator("figcaption").count(), 0);
      const headspots = illustration.locator(".brand-headspot");
      assert.equal(await headspots.count(), 2);
      assert.deepEqual(await headspots.evaluateAll((spots) => spots.map((spot) => ({
        label: spot.getAttribute("aria-label"),
        target: spot.getAttribute("aria-controls"),
      }))), [
        { label: "与 binbin 打招呼", target: "brandVoiceMale" },
        { label: "与 Lydia 打招呼", target: "brandVoiceFemale" },
      ]);
      const maleSpot = headspots.nth(0);
      const femaleSpot = headspots.nth(1);
      const maleVoice = illustration.locator("#brandVoiceMale");
      const femaleVoice = illustration.locator("#brandVoiceFemale");
      assert.equal(await maleVoice.isHidden(), true);
      assert.equal(await femaleVoice.isHidden(), true);
      await maleSpot.hover();
      assert.equal(await maleVoice.isVisible(), true);
      assert.equal(await maleVoice.textContent(), "大家好，我是 binbin");
      assert.equal(await femaleVoice.isHidden(), true);
      await femaleSpot.hover();
      assert.equal(await maleVoice.isHidden(), true);
      assert.equal(await femaleVoice.isVisible(), true);
      assert.equal(await femaleVoice.textContent(), "大家好，我是Lydia");
      const voiceBox = await femaleVoice.boundingBox();
      assert.ok(voiceBox.x >= 8 && voiceBox.x + voiceBox.width <= viewport.width - 8, "the bubble should stay inside the viewport");
      await page.mouse.move(1, 1);
      assert.equal(await femaleVoice.isHidden(), true);
      await maleSpot.click();
      assert.equal(await maleVoice.isVisible(), true);
      await page.mouse.move(1, 1);
      assert.equal(await maleVoice.isHidden(), true, "mouse focus must not keep a bubble visible after leaving");
      await page.keyboard.press("Tab");
      assert.equal(await femaleSpot.evaluate((spot) => document.activeElement === spot), true);
      assert.equal(await femaleVoice.isVisible(), true);
      await page.keyboard.press("Escape");
      assert.equal(await femaleVoice.isHidden(), true);
      assert.equal(await illustration.evaluate((figure) => {
        const opening = figure.previousElementSibling;
        const chapters = figure.nextElementSibling;
        return opening?.classList.contains("philosophy-opening") && chapters?.classList.contains("philosophy-chapters");
      }), true);
      assert.equal(await illustration.locator("img").evaluate(async (image) => {
        await image.decode();
        return image.naturalWidth === 1536 && image.naturalHeight === 1024;
      }), true);
      for (const [index, theme] of themes.entries()) {
        const chapter = philosophy.locator(".philosophy-chapter").nth(index);
        assert.equal(await chapter.locator("h3").textContent(), theme);
        assert.match(await chapter.locator("figcaption").textContent(), /官方画册/);
        await chapter.locator("img").scrollIntoViewIfNeeded();
        const imageBox = await chapter.locator("img").boundingBox();
        assert.ok(Math.abs(imageBox.width / imageBox.height - 1.5) < 0.02);
        assert.equal(await chapter.locator("img").evaluate(async (image) => {
          await image.decode();
          return image.naturalWidth > 0 && image.naturalWidth / image.naturalHeight >= 1.2;
        }), true);
      }
      const perspective = page.getByRole("region", { name: "个人视角" });
      assert.match(await perspective.textContent(), /非品牌官方原文/);
      assert.match(await perspective.textContent(), /留白不是“什么都没有”/);
      const catalog = page.getByRole("region", { name: "文章目录" });
      assert.equal(await page.locator(".story-feature").count(), 8);
      assert.equal(await page.evaluate(() => window.BELONGS_STORIES.length), 93);
      assert.equal(await page.evaluate(() => window.BELONGS_STORIES.find((story) => story.id === "2021-122-83ea808aad").hasOriginalTitle), false);
      assert.equal(await catalog.locator(".story-entry").count(), 12);
      assert.match(await catalog.locator(".story-entry a[title='查看原图']").first().getAttribute("href"), /^assets\/images\//);
      assert.match(await catalog.locator("#storyPageInfo").textContent(), /1 \/ 8/);
      assert.match(await catalog.locator("#storyResultCount").textContent(), /93/);
      await catalog.getByRole("button", { name: "2021" }).click();
      await catalog.locator("#storySearch").fill("侘寂之美");
      await catalog.getByRole("button", { name: "查看原文" }).click();
      const sourceDialog = page.getByRole("dialog", { name: "官方图文原文" });
      assert.equal(await sourceDialog.isVisible(), true);
      assert.match(await sourceDialog.textContent(), /侘寂和粗制滥造是完全的两极/);
      await sourceDialog.getByRole("button", { name: "关闭" }).click();
      assert.equal(await sourceDialog.isVisible(), false);
      await catalog.locator("#storySearch").fill("");
      await catalog.getByRole("button", { name: "全部", exact: true }).click();
      await catalog.locator("#storyNextPage").click();
      assert.match(await catalog.locator("#storyPageInfo").textContent(), /2 \/ 8/);
      await catalog.getByRole("button", { name: "2022" }).click();
      assert.equal(await catalog.locator(".story-entry").count(), 12);
      assert.match(await catalog.locator("#storyResultCount").textContent(), /49/);
      assert.match(await catalog.locator("#storyPageInfo").textContent(), /1 \/ 5/);
      await catalog.locator("#storySearch").fill("初心羽");
      assert.ok(await catalog.locator(".story-entry").count() > 0);
      assert.match(await catalog.locator("#storyResultCount").textContent(), /[1-9]/);
      await catalog.locator("#storySearch").fill("");
      await catalog.getByRole("button", { name: "2024—2026" }).click();
      assert.equal(await catalog.locator(".story-entry").count(), 7);
      assert.equal(await page.locator(".philosophy-section ~ .story-list").count(), 1);
      const cards = page.locator(".story-card");
      assert.equal(await cards.count(), expected.length);
      for (let index = 0; index < expected.length; index += 1) {
        const [title, id] = expected[index];
        const card = cards.nth(index);
        assert.match(await card.locator("h2").textContent(), new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(await card.getAttribute("href"), new RegExp(id));
        assert.equal(await card.getAttribute("target"), "_blank");
        assert.equal(await card.getAttribute("rel"), "noopener noreferrer");
        await card.locator("img").scrollIntoViewIfNeeded();
        assert.equal(await card.locator("img").evaluate(async (image) => {
          await image.decode();
          return image.naturalWidth > 0;
        }), true);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      console.log(`PASS brand story frames and interactions ${viewport.width}px`);
      await page.close();
    }
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await touch.goto(`file://${path.join(root, "brand-story.html")}`);
    const male = touch.getByRole("button", { name: "与 binbin 打招呼" });
    const female = touch.getByRole("button", { name: "与 Lydia 打招呼" });
    await male.tap();
    assert.equal(await touch.locator("#brandVoiceMale").isVisible(), true);
    await male.tap();
    assert.equal(await touch.locator("#brandVoiceMale").isHidden(), true);
    await female.tap();
    assert.equal(await touch.locator("#brandVoiceFemale").isVisible(), true);
    await touch.locator(".brand-illustration img").tap({ position: { x: 10, y: 20 } });
    assert.equal(await touch.locator("#brandVoiceFemale").isHidden(), true);
    await touch.close();
    console.log("PASS touch greeting toggles and outside dismissal");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
