import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const [width, view] of [[1440, "grid"], [1440, "list"], [390, "grid"], [390, "list"], [320, "grid"], [320, "list"]]) {
    for (const route of ["index.html", "index.html?release=invited", "index.html?release=custom", "index.html?release=display", "player.html"]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const url = new URL(`file://${path.join(root, route.split("?")[0])}`);
      url.search = route.split("?")[1] || "";
      url.searchParams.set("view", view);
      await page.goto(url.href);
      if (await page.locator("#closeIntro").isVisible()) await page.locator("#closeIntro").click();
      const photos = page.locator("#gallery .thumb img");
      assert.ok(await photos.count() > 0, `${route}: gallery must contain real covers`);
      for (const photo of await photos.all()) {
        await photo.scrollIntoViewIfNeeded();
        await photo.evaluate((image) => image.decode());
        const fit = await photo.evaluate((image) => {
          const frame = image.closest(".thumb").getBoundingClientRect();
          const box = image.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && box.left >= frame.left - 1 && box.right <= frame.right + 1
            && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1 && getComputedStyle(image).objectFit === "contain";
        });
        assert.equal(fit, true, `${route} ${width}px ${view}: ${await photo.getAttribute("alt")} cover must fit without clipping`);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.close();
      console.log(`PASS complete covers: ${route} ${width}px ${view}`);
    }
  }
} finally {
  await browser.close();
}
