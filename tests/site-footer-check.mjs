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

async function checkFooter(browser, filename, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`file://${path.join(root, filename)}`);
  if (await page.locator("#closeIntro").isVisible()) await page.locator("#closeIntro").click();

  const footer = page.getByRole("contentinfo", { name: "品牌落款" });
  assert.equal(await footer.count(), 1, "each album page should have one closing brand signature");
  assert.equal(await footer.locator(".brand-closing-quote").textContent(), "前路漫漫亦灿灿，作品既是艺术亦是态度。");
  assert.equal(await footer.locator(".brand-closing-signature").textContent(), "BELONGS B&K® Est.2019");
  const mainBox = await page.locator("main").boundingBox();
  const footerBox = await footer.boundingBox();
  assert.ok(footerBox.y >= mainBox.y + mainBox.height + 48, "the signature should follow the content with breathing room");
  assert.equal(await footer.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.position === "static" && style.backgroundColor === "rgb(95, 105, 107)"
      && style.borderTopWidth === "0px" && style.color === "rgb(244, 241, 234)";
  }), true, "the footer should stay in normal flow without a new palette or border");

  await footer.scrollIntoViewIfNeeded();
  const lines = await footer.locator(".brand-closing-quote span").evaluateAll((spans) =>
    spans.map((span) => {
      const box = span.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    }));
  assert.equal(lines.length, 2);
  if (width <= 680) assert.ok(lines[1].top >= lines[0].bottom, "mobile quote should break at the comma");
  else assert.equal(lines[1].top, lines[0].top, "desktop quote should fit on one line");
  assert.equal(await footer.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return [...element.querySelectorAll("span, p")].every((node) => {
      const box = node.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth && box.top >= bounds.top && box.bottom <= bounds.bottom
        && node.scrollWidth <= node.clientWidth + 1;
    }) && document.documentElement.scrollWidth <= innerWidth;
  }), true, "footer text should fit on the page without overflow or clipping");
  assert.deepEqual(errors, []);
  console.log(`PASS brand closing ${filename} ${width}px`);
  await page.close();
}

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    for (const filename of ["index.html", "index.html?view=list", "player.html", "brand-story.html"]) {
      for (const width of [1440, 390, 320]) await checkFooter(browser, filename, width);
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
