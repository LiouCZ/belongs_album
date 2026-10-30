import assert from "node:assert/strict";
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
    for (const width of [320, 390, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`file://${path.join(root, filename)}`);
      if (filename.startsWith("index.html")) await page.locator("#closeIntro").click();
      const current = page.locator('.site-nav [aria-current="page"]');
      assert.equal(await current.count(), 1, "exactly one current navigation link should be identified");
      assert.equal(await current.getAttribute("href"), filename.split("?")[0]);
      assert.equal(await page.locator(".site-nav .top-link").count(), 3);
      assert.equal(await page.locator(".top-actions .top-link--utility").getAttribute("href"), "vip.html");
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
        assert.equal(await stats.isVisible(), true);
        assert.match(await stats.textContent(), /组/);
        assert.ok(await stats.evaluate((node) => parseFloat(getComputedStyle(node).fontSize) <= 16));
        if ([390, 1440].includes(width) && filename === "index.html") {
          const navigation = await page.locator(".site-nav").boundingBox();
          await page.locator("#searchInput").fill("no-matching-album-entry");
          assert.equal(await stats.locator("#visibleCount").textContent(), "0");
          assert.equal((await page.locator(".site-nav").boundingBox()).x, navigation.x,
            "count changes should not move the navigation");
          await page.locator("#searchInput").fill("");
        }
      }
      if (process.env.NAV_SCREENSHOT_DIR && [390, 1440].includes(width)) {
        await page.locator(".top-actions .top-link--utility").focus();
        await page.mouse.click(2, 2);
        await page.locator(".topbar").screenshot({ path: path.join(process.env.NAV_SCREENSHOT_DIR,
          `nav-${filename.replace(/[.?=]/g, "-")}-${width}.png`) });
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
