import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const width of [1440, 390, 320]) {
    for (const route of ["index.html?view=grid", "index.html?view=list", "player.html"]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      await page.addInitScript(() => {
        const photo = { year: "2026", date: "2026", datePrecision: "year", releaseType: "regular", caption: "",
          image: "assets/official-uploads/2026-custom-gold-opal-coin/1-front.jpg", thumb: "assets/official-uploads/2026-custom-gold-opal-coin/1-thumb-front-thumb.jpg",
          width: 5760, height: 3840, thumbWidth: 960, thumbHeight: 640, collection: "测试合集" };
        const work = (id, title, stamps, index) => ({ ...photo, id, workId: id, title, sourceIndex: index, index, ...(stamps ? { coverStamps: stamps } : {}) });
        const items = [work("gold", "全金镶嵌作品", ["gold"], 1), work("antique", "古董改造作品", ["antique"], 3),
          work("dual", "双章作品", ["antique", "gold"], 4), work("silver", "先金羽翼", null, 5),
          work("plain", "普通作品", null, 6), work("same-copy", "普通作品", ["gold"], 7)];
        items.splice(1, 0, { ...items[0], id: "gold-back", sourceIndex: 2, index: 2 });
        Object.defineProperty(window, "BELONGS_DATA", { value: { items }, writable: false });
        Object.defineProperty(window, "BELONGS_CURATED", { value: { items: [], articles: [] }, writable: false });
      });
      await page.goto(`file://${path.join(root, route)}`);
      await page.locator("#gallery .card").first().waitFor({ timeout: 5000 }).catch(async (error) => {
        throw new Error(`${width}px ${route}: ${errors.join("; ") || error.message}; ${await page.locator("#summaryText").textContent()}`);
      });
      if (await page.locator("#closeIntro").isVisible()) await page.locator("#closeIntro").click();
      const gold = page.locator("#gallery .card").filter({ has: page.locator("h3", { hasText: "全金镶嵌作品" }) });
      assert.equal(await gold.locator('[role="img"][aria-label="全金作品"]').count(), 1, `one work carousel must show its stamp only once on the cover: ${await page.locator("#gallery h3").allTextContents()}`);
      assert.equal(await page.locator("#gallery .card").count(), 6, "stamp facts must not leak to unmarked works with matching copy");
      assert.equal(await page.locator("#gallery .card").filter({ hasText: "先金羽翼" }).locator(".cover-stamp").count(), 0, "gold and silver work must not be guessed from its title");
      const plain = page.locator("#gallery .card").filter({ has: page.locator("h3", { hasText: /^普通作品$/ }) });
      assert.equal(await plain.count(), 2);
      assert.equal(await plain.locator(".cover-stamp").count(), 1);
      const dual = page.locator("#gallery .card").filter({ hasText: "双章作品" });
      assert.deepEqual(await dual.locator(".cover-stamp").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label"))), ["全金作品", "古董改造"]);
      for (const card of await page.locator("#gallery .card").all()) {
        await card.scrollIntoViewIfNeeded();
        assert.equal(await card.evaluate((node) => {
          const frame = node.querySelector(".thumb").getBoundingClientRect();
          const stamps = [...node.querySelectorAll(".cover-stamp")];
          const boxes = stamps.map((stamp) => stamp.getBoundingClientRect());
          const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const counter = node.querySelector(".image-count")?.getBoundingClientRect();
          return boxes.every((box, index) => box.width >= 32 && box.height === box.width && box.left >= frame.left && box.right <= frame.right + 1 && box.top >= frame.top && box.bottom <= frame.bottom + 1
            && (!counter || !overlaps(box, counter)) && boxes.every((other, j) => index === j || !overlaps(box, other))
            && getComputedStyle(stamps[index]).pointerEvents === "none" && getComputedStyle(stamps[index]).backgroundImage.includes("stamp.png"));
        }), true, `${width}px ${route}: stamps must fit without overlapping each other or counters`);
      }
      await gold.scrollIntoViewIfNeeded();
      const stamp = await gold.locator(".cover-stamp").boundingBox();
      await page.mouse.click(stamp.x + stamp.width / 2, stamp.y + stamp.height / 2);
      assert.equal(await page.locator("#detailDialog").evaluate((node) => node.open), true, "the overlay must not block opening details");
      assert.equal(await page.locator("#carouselCount").textContent(), "1 / 2");
      await page.locator("#nextImage").click();
      assert.equal(await page.locator("#carouselCount").textContent(), "2 / 2");
      await page.locator("#closeDialog").click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.STAMP_SCREENSHOT_DIR) {
        await mkdir(process.env.STAMP_SCREENSHOT_DIR, { recursive: true });
        await dual.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(process.env.STAMP_SCREENSHOT_DIR, `stamps-${width}-${route.replace(/[^a-z]/g, "-")}.png`), fullPage: true });
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS cover stamp display, grouping and clicks ${width}px ${route}`);
    }
  }
} finally {
  await browser.close();
}
