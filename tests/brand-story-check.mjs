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

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    for (const pageName of ["index.html", "player.html"]) {
      const page = await browser.newPage();
      await page.goto(`file://${path.join(root, pageName)}`);
      assert.equal(await page.getByRole("link", { name: "品牌故事" }).getAttribute("href"), "brand-story.html");
      await page.close();
    }

    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      await page.goto(`file://${path.join(root, "brand-story.html")}`);
      assert.equal(await page.locator("h1").textContent(), "品牌故事");
      const cards = page.locator(".story-card");
      assert.equal(await cards.count(), expected.length);
      for (let index = 0; index < expected.length; index += 1) {
        const [title, id] = expected[index];
        const card = cards.nth(index);
        assert.match(await card.locator("h2").textContent(), new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(await card.getAttribute("href"), new RegExp(id));
        assert.equal(await card.getAttribute("target"), "_blank");
        assert.equal(await card.getAttribute("rel"), "noopener noreferrer");
        assert.equal(await card.locator("img").evaluate(async (image) => {
          await image.decode();
          return image.naturalWidth > 0;
        }), true);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
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
