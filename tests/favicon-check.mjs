import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json")) : createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  for (const filename of ["index.html", "player.html", "brand-story.html", "vip.html", "custom-rules.html"]) {
    for (const colorScheme of ["light", "dark"]) {
      const page = await browser.newPage({ colorScheme });
      try {
        await page.goto(`file://${path.join(root, filename)}`);
        const icon = await page.locator('link[rel="icon"]').evaluateAll((links) => {
          const active = links.filter((link) => !link.media || matchMedia(link.media).matches).at(-1);
          return active ? { href: active.getAttribute("href"), type: active.type, sizes: active.sizes.value } : null;
        });
        assert.ok(icon && icon.href.startsWith("assets/"), "every page uses a local logo instead of an empty favicon");
        assert.equal(icon.type, "image/png");
        assert.equal(icon.sizes, "256x256");
        assert.equal(icon.href, colorScheme === "dark" ? "assets/favicon-white.png" : "assets/favicon.png",
          "the transparent mark must remain visible on both light and dark browser tabs");
        assert.deepEqual(await page.evaluate(async (href) => {
          const image = new Image();
          image.src = href;
          await image.decode();
          return [image.naturalWidth, image.naturalHeight];
        }, icon.href), [256, 256], "the favicon must load from the page-relative URL");
        console.log(`PASS favicon ${filename} ${colorScheme}`);
      } finally {
        await page.close();
      }
    }
  }

  const icons = [];
  for (const [filename, color] of [["favicon.png", [17, 19, 21]], ["favicon-white.png", [255, 255, 255]]]) {
    const { data, info } = await sharp(path.join(root, "assets", filename)).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels], [256, 256, 4]);
    let visiblePixels = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const pixel = (y * info.width + x) * 4;
        if (x === 0 || y === 0 || x === 255 || y === 255) assert.equal(data[pixel + 3], 0);
        if (data[pixel + 3] > 127) {
          visiblePixels += 1;
          assert.deepEqual([...data.subarray(pixel, pixel + 3)], color);
        }
      }
    }
    assert.ok(visiblePixels > 2000 && visiblePixels < 12000, "the transparent icon contains the visible logo, not a solid backdrop");
    icons.push(data);
  }
  for (let index = 3; index < icons[0].length; index += 4) {
    assert.equal(icons[0][index], icons[1][index], "theme variants preserve exactly the same logo outline");
  }
  console.log("PASS transparent favicon pixels and matching theme silhouettes");
} finally {
  await browser.close();
}
