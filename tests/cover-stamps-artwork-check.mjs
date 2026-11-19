import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"));
const { chromium } = require("playwright");
const sharp = require("sharp");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
  for (const name of ["gold-work-stamp", "antique-rework-stamp"]) {
    const svg = await readFile(path.join(root, "assets/cover-stamps", `${name}.svg`), "utf8");
    await page.setContent(`<style>body{margin:0}svg{display:block;width:640px;height:640px}</style>${svg}`);
    await page.evaluate(() => document.fonts.ready);
    const footer = page.locator("svg > text").filter({ hasText: /^\s*since 2019\s*$/ });
    assert.equal(await footer.count(), 1, `${name}: replace the hourglass with since 2019`);
    assert.equal(await footer.locator("textPath").count(), 1, `${name}: follow the lower inner ring instead of using a straight line`);
    const arc = await footer.evaluate((node) => {
      const brand = node.parentNode.querySelector('textPath[href="#brand-arc"]').parentNode;
      const positions = Array.from({ length: node.getNumberOfChars() }, (_, index) => {
        const point = node.getStartPositionOfChar(index);
        return { x: point.x, y: point.y, radius: Math.hypot(point.x - 80, point.y - 80), rotation: node.getRotationOfChar(index) };
      });
      return { positions, font: getComputedStyle(node).fontFamily, size: getComputedStyle(node).fontSize,
        brandFont: getComputedStyle(brand).fontFamily, brandSize: getComputedStyle(brand).fontSize };
    });
    assert.equal(arc.font, arc.brandFont, `${name}: match the upper lettering font`);
    const sizeRatio = parseFloat(arc.size) / parseFloat(arc.brandSize);
    assert.ok(sizeRatio >= 1.25 && sizeRatio <= 1.35, `${name}: enlarge the lower lettering by about 30 percent`);
    assert.ok(arc.positions.every((point) => point.y > 130 && point.radius >= 62 && point.radius <= 65), `${name}: hug the lower inner ring`);
    assert.ok(Math.abs(arc.positions[0].rotation) > 5 && Math.abs(arc.positions.at(-1).rotation) > 5, `${name}: curve the individual letters along the ring`);
    const bounds = await footer.evaluate((node) => {
      const box = node.getBBox();
      const lines = [...node.parentNode.querySelectorAll("g > text")].map((line) => line.getBBox());
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        titleBottom: Math.max(...lines.map((line) => line.y + line.height)) };
    });
    assert.ok(Math.abs(bounds.x + bounds.width / 2 - 80) < 0.1, `${name}: center the footer`);
    assert.ok(bounds.y >= bounds.titleBottom + 4, `${name}: leave space below the Chinese title`);
    assert.ok(bounds.y + bounds.height < 146.5, `${name}: keep the footer above the inner ring`);
    const png = await readFile(path.join(root, "assets/cover-stamps", `${name}.png`));
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.width, 640);
    assert.equal(metadata.height, 640);
    assert.equal(metadata.hasAlpha, true, `${name}: keep the transparent background`);
    const rendered = await page.screenshot({ omitBackground: true });
    const area = { left: 160, top: 440, width: 320, height: 160 };
    const expected = await sharp(rendered).extract(area).ensureAlpha().raw().toBuffer();
    const actual = await sharp(png).extract(area).ensureAlpha().raw().toBuffer();
    const difference = actual.reduce((sum, channel, index) => sum + Math.abs(channel - expected[index]), 0) / actual.length;
    assert.ok(difference < 0.5, `${name}: PNG footer must match the SVG (pixel difference ${difference})`);
    assert.equal((await sharp(png).ensureAlpha().raw().toBuffer())[3], 0, `${name}: corners must remain transparent`);
    if (process.env.STAMP_SCREENSHOT_DIR) {
      await mkdir(process.env.STAMP_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.STAMP_SCREENSHOT_DIR, `${name}.png`), omitBackground: true });
    }
    console.log(`PASS ${name}: lower-arc since 2019, matching type, spacing and transparent PNG`);
  }
} finally {
  await browser.close();
}
