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
      assert.equal(await page.locator(".top-actions").evaluate((navigation) => {
        const style = getComputedStyle(navigation);
        const header = document.querySelector(".album-header");
        const active = navigation.querySelector('[aria-current="page"]');
        const selected = getComputedStyle(active);
        const inactive = getComputedStyle(navigation.querySelector("a:not([aria-current])"));
        return style.position === "sticky" && style.top === "0px" && !navigation.closest("header")
          && style.borderTopWidth === "0px" && style.borderBottomWidth === "0px"
          && getComputedStyle(header).borderBottomWidth === "0px"
          && selected.backgroundColor === "rgb(244, 241, 234)" && selected.color === "rgb(17, 19, 21)"
          && inactive.backgroundColor === "rgba(0, 0, 0, 0)"
          && getComputedStyle(active, "::after").content === "none";
      }), true, "pin the navigation without dividers and distinguish the selected page with the existing light-paper palette");
      assert.equal(await page.evaluate(() => {
        const title = getComputedStyle(document.querySelector(".brand h1"));
        const introduction = getComputedStyle(document.querySelector(".brand-description"));
        const category = document.querySelector(".release-nav");
        const label = document.querySelector(".controls label > span");
        const primary = getComputedStyle(document.querySelector('.site-nav [aria-current="page"]'));
        const secondary = getComputedStyle(document.querySelector(".brand-contact-label"));
        const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map((channel) => {
          const value = Number(channel) / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const background = luminance(getComputedStyle(document.querySelector(".album-header")).backgroundColor);
        return parseFloat(title.fontSize) >= parseFloat(introduction.fontSize) * 1.6
          && Number(title.fontWeight) >= 600
          && title.color !== introduction.color && introduction.color !== secondary.color
          && [introduction.color, secondary.color].every((color) => {
            const foreground = luminance(color);
            return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) >= 4.5;
          })
          && (!category || getComputedStyle(category).borderBottomWidth === "0px"
            && parseFloat(primary.fontSize) >= parseFloat(getComputedStyle(category.querySelector("a")).fontSize))
          && (!label || parseFloat(getComputedStyle(label).fontSize) <= 11);
      }), true, "brand, page tabs, work type and filter labels have distinct visual levels");
      assert.equal(await page.evaluate(() => {
        const boxes = [...document.querySelectorAll(".site-nav a")].map((node) => node.getBoundingClientRect());
        const same = (a, b) => Math.abs(a - b) < 1;
        return boxes.every((box) => same(box.top, boxes[0].top));
      }), true, "navigation stays on one clear row on phones and desktop");
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
      await page.evaluate(() => window.scrollTo(0, 650));
      await page.waitForFunction(() => Math.abs(document.querySelector(".top-actions").getBoundingClientRect().top) < 1);
      assert.equal(await page.locator(".top-actions").evaluate((navigation) => {
        const box = navigation.getBoundingClientRect();
        return document.querySelector(".brand").getBoundingClientRect().bottom < 0
          && box.height <= 64 && [...navigation.querySelectorAll(".site-nav a")].every((link) => {
            const bounds = link.getBoundingClientRect();
            const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            return bounds.top >= 0 && bounds.bottom <= box.bottom && link.contains(hit);
          });
      }), true, "the compact navigation stays visible and clickable after the brand introduction scrolls away");
      await page.evaluate(() => window.scrollTo(0, 0));
      if (process.env.NAV_SCREENSHOT_DIR && [320, 390, 655, 1440].includes(width)) {
        mkdirSync(process.env.NAV_SCREENSHOT_DIR, { recursive: true });
        await page.locator(".top-actions .top-link--utility").focus();
        await page.mouse.click(2, 2);
        await page.locator(".top-actions").screenshot({ path: path.join(process.env.NAV_SCREENSHOT_DIR,
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
