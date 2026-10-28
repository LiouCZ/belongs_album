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

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`file://${path.join(root, "player.html")}`);
    const transitioning = await page.locator('.site-nav a[href="brand-story.html"]').evaluate((link) => {
      link.click();
      return document.querySelector(".page-hourglass-transition")?.classList.contains("is-leaving") || false;
    });
    assert.equal(transitioning, true);
    assert.equal(await page.locator(".page-hourglass-transition").evaluate((element) => getComputedStyle(element).animationDuration), "0.45s");
    await page.waitForURL(/brand-story\.html$/);
    await page.locator(".page-hourglass-transition").waitFor({ state: "detached" });
    assert.equal(await page.locator(".site-nav .is-active").textContent(), "品牌故事");
    await page.close();

    const reduced = await browser.newPage({ reducedMotion: "reduce" });
    await reduced.goto(`file://${path.join(root, "player.html")}`);
    const hasTransition = await reduced.locator('.site-nav a[href="brand-story.html"]').evaluate((link) => {
      link.click();
      return Boolean(document.querySelector(".page-hourglass-transition"));
    });
    assert.equal(hasTransition, false);
    await reduced.waitForURL(/brand-story\.html$/);
    await reduced.close();
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
