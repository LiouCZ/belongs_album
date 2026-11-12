import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json")) : createRequire(import.meta.url);
const { chromium } = require("playwright");
const destination = "https://d.weimob.com/d/1_11_10c9bva";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  for (const filename of ["index.html", "player.html", "brand-story.html"]) {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`file://${path.join(root, filename)}`);
      if (filename === "index.html") await page.locator("#closeIntro").click();
      const link = page.locator("[data-mini-program]");
      assert.equal(await link.evaluate((node) => node.tagName), "A", "the mini program should now open its supplied URL directly");
      assert.equal(await link.getAttribute("href"), destination);
      assert.equal(await link.getAttribute("target"), "_blank");
      assert.match(await link.getAttribute("rel"), /\bnoopener\b/);
      assert.match(await link.getAttribute("rel"), /\bnoreferrer\b/);
      assert.equal(await link.getAttribute("aria-haspopup"), null, "remove the obsolete copy-dialog semantics");
      assert.equal(await link.getAttribute("aria-controls"), null);
      assert.equal(await page.locator("#miniProgramDialog, script[src='mini-program.js']").count(), 0);
      assert.equal(await link.locator("img[src='assets/icons/external-link.svg']").count(), 1);
      await page.keyboard.press("Tab");
      await link.focus();
      assert.equal(await link.evaluate((node) => getComputedStyle(node).outlineStyle !== "none"), true);
      await page.context().route(destination, (route) => route.fulfill({ contentType: "text/html", body: "Mini program destination" }));
      const [target] = await Promise.all([page.waitForEvent("popup"), link.press("Enter")]);
      await target.waitForURL(destination);
      assert.equal(await target.evaluate(() => window.opener === null), true);
      await target.close();
      assert.equal(page.url(), `file://${path.join(root, filename)}`, "keep the album open in its original tab");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      console.log(`PASS direct mini program link, new tab, keyboard and layout: ${filename} ${width}px`);
      await page.close();
    }
    const staticPage = await browser.newPage({ javaScriptEnabled: false });
    await staticPage.goto(`file://${path.join(root, filename)}`);
    assert.equal(await staticPage.locator("[data-mini-program]").getAttribute("href"), destination,
      "the direct URL must also be available without JavaScript");
    await staticPage.close();
  }
} finally {
  await browser.close();
}
