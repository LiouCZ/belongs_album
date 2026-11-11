import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runtimeRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json")) : require;
const { chromium } = runtimeRequire("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  for (const filename of ["index.html", "index.html?view=list", "player.html", "brand-story.html"]) {
    for (const width of [320, 390, 580, 655, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`file://${path.join(root, filename)}`);
      if (filename.startsWith("index.html")) await page.locator("#closeIntro").click();
      const current = page.locator('.site-nav [aria-current="page"]');
      assert.equal(await current.count(), 1, "exactly one current navigation link should be identified");
      assert.equal(await current.getAttribute("href"), filename.split("?")[0]);
      assert.equal(await page.locator(".site-nav .top-link").count(), 4, "VIP belongs in the main navigation instead of an isolated row");
      const vip = page.locator('.site-nav a[href="vip.html"]');
      assert.equal(await vip.isVisible(), true);
      assert.equal(await vip.evaluate((link) => getComputedStyle(link).borderTopWidth), "0px", "VIP should be a quiet text link, not a framed button");
      assert.equal(await page.locator(".topbar .stats").count(), 0, "album counts belong with the results, not in the header");
      assert.equal(await page.evaluate((mobile) => {
        const boxes = [...document.querySelectorAll(".site-nav a")].map((node) => node.getBoundingClientRect());
        const same = (a, b) => Math.abs(a - b) < 1;
        return mobile
          ? same(boxes[0].top, boxes[1].top) && same(boxes[2].top, boxes[3].top)
            && boxes[2].top >= boxes[0].bottom && same(boxes[0].left, boxes[2].left) && same(boxes[1].left, boxes[3].left)
          : boxes.every((box) => same(box.top, boxes[0].top));
      }, width <= 580), true, "navigation must form two aligned mobile rows or a single wider row");
      assert.equal(await page.evaluate(() => {
        const controls = [...document.querySelectorAll(".top-actions .top-link, .site-egg-trigger, .stats")]
          .filter((node) => getComputedStyle(node).display !== "none").map((node) => node.getBoundingClientRect());
        return document.documentElement.scrollWidth <= innerWidth && controls.every((box, index) =>
          box.width > 0 && box.height >= 32 && box.left >= 0 && box.right <= innerWidth
          && controls.slice(index + 1).every((other) => box.right <= other.left || other.right <= box.left
            || box.bottom <= other.top || other.bottom <= box.top));
      }), true, `${filename} ${width}px navigation should fit without overlap`);
      await page.keyboard.press("Tab");
      await page.locator('.site-nav a[href="player.html"]').focus();
      assert.equal(await page.locator('.site-nav a[href="player.html"]').evaluate((node) =>
        getComputedStyle(node).outlineStyle !== "none"), true, "keyboard focus should be visible");
      if (filename !== "brand-story.html") {
        const stats = page.locator(".stats");
        assert.equal(await page.locator(".results-bar .stats").count(), 1);
        assert.equal(await stats.isVisible(), true);
        assert.match(await stats.textContent(), /组/);
        assert.ok(await stats.evaluate((node) => parseFloat(getComputedStyle(node).fontSize) <= 16));
        assert.equal(await page.locator(".results-bar").evaluate((bar) => {
          const boxes = [...bar.querySelectorAll(".stats, .view-switch, .summary, .list-view-heading")]
            .filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.getBoundingClientRect());
          return boxes.every((box, index) => boxes.slice(index + 1).every((other) =>
            box.right <= other.left + 1 || other.right <= box.left + 1 || box.bottom <= other.top + 1 || other.bottom <= box.top + 1));
        }), true, "result counts, text and view controls must not overlap");
        if ([390, 1440].includes(width) && filename === "index.html") {
          const navigation = await page.locator(".site-nav").boundingBox();
          await page.locator("#searchInput").fill("no-matching-album-entry");
          assert.equal(await stats.locator("#visibleCount").textContent(), "0");
          assert.equal((await page.locator(".site-nav").boundingBox()).x, navigation.x,
            "count changes should not move the navigation");
          await page.locator("#searchInput").fill("");
        }
      }
      if (process.env.NAV_SCREENSHOT_DIR && [320, 390, 655, 1440].includes(width)) {
        mkdirSync(process.env.NAV_SCREENSHOT_DIR, { recursive: true });
        await page.locator(".top-actions .top-link--utility").focus();
        await page.mouse.click(2, 2);
        await page.locator(".topbar").screenshot({ path: path.join(process.env.NAV_SCREENSHOT_DIR,
          `nav-${filename.replace(/[.?=]/g, "-")}-${width}.png`) });
        await page.screenshot({ path: path.join(process.env.NAV_SCREENSHOT_DIR,
          `page-${filename.replace(/[.?=]/g, "-")}-${width}.png`) });
      }
      await page.locator("#siteEggTrigger").click();
      assert.equal(await page.locator("#siteEggDialog").isVisible(), true);
      await page.locator(".site-egg-header button").click();
      await page.locator('.site-nav a[href="brand-story.html"]').click();
      await page.waitForURL(/brand-story\.html$/);
      assert.equal(await page.locator('.site-nav [aria-current="page"]').textContent(), "品牌故事");
      await page.locator('.top-actions a[href="vip.html"]').click();
      await page.waitForURL(/vip\.html$/);
      assert.deepEqual(errors, []);
      console.log(`PASS navigation layout, focus, links, egg and counts: ${filename} ${width}px`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
