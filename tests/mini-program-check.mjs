import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"));
const { chromium } = require("playwright");
const token = "#小程序://BELONGSB&K/kpn1xWp1jF1hyqu";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

async function openPage(filename, width, mode = "success") {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(5000);
  await page.addInitScript((mode) => {
    Object.defineProperty(navigator, "clipboard", {
      value: mode === "missing" ? undefined : { writeText: async (text) => {
        if (mode !== "success") throw new Error("Clipboard denied");
        window.__copiedMiniProgram = text;
      } },
    });
    document.execCommand = (command) => {
      if (command !== "copy" || mode === "failure") return false;
      const field = document.activeElement;
      window.__copiedMiniProgram = field.value.slice(field.selectionStart, field.selectionEnd);
      return true;
    };
  }, mode);
  await page.goto(`file://${path.join(root, filename)}`);
  if (filename === "index.html") await page.locator("#closeIntro").click();
  return page;
}

try {
  for (const filename of ["index.html", "player.html", "brand-story.html"]) {
    for (const width of [320, 390, 1440]) {
      const page = await openPage(filename, width);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const info = page.locator(".brand-public-info");
      assert.match(await info.textContent(), /微信公众号：BELONGS OFFICIAL/);
      assert.match(await info.textContent(), /微信小程序：BELONGS B&K/);
      const trigger = info.getByRole("button", { name: "BELONGS B&K", exact: true });
      assert.equal(await trigger.count(), 1, "the mini program needs a separate entry, not a fragment link");
      const dialog = page.getByRole("dialog", { name: "BELONGS B&K", exact: true });
      await trigger.click();
      assert.equal(await dialog.isVisible(), true);
      const field = dialog.getByRole("textbox", { name: "小程序分享口令" });
      assert.equal(await field.inputValue(), token);
      assert.equal(await field.getAttribute("readonly"), "");
      await dialog.getByRole("button", { name: "复制口令", exact: true }).click();
      await page.waitForFunction(() => document.querySelector("#miniProgramStatus").textContent === "口令已复制");
      assert.equal(await page.evaluate(() => window.__copiedMiniProgram), token);
      assert.equal(await page.evaluate(() => {
        const box = document.querySelector("#miniProgramDialog").getBoundingClientRect();
        const field = document.querySelector("#miniProgramCode");
        return document.documentElement.scrollWidth <= innerWidth && box.left >= 0 && box.right <= innerWidth
          && field.scrollWidth <= field.clientWidth + 1 && field.scrollHeight <= field.clientHeight + 1;
      }), true, "the header and full share code must fit without clipping");
      if (process.env.SOCIAL_SCREENSHOT_DIR && filename === "index.html") {
        mkdirSync(process.env.SOCIAL_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.SOCIAL_SCREENSHOT_DIR, `mini-program-${width}.png`) });
      }
      await dialog.getByRole("button", { name: "关闭小程序", exact: true }).click();
      assert.equal(await dialog.isVisible(), false);
      assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
      await trigger.press("Enter");
      assert.equal(await dialog.getByRole("status").textContent(), "");
      await page.keyboard.press("Escape");
      assert.equal(await dialog.isVisible(), false);
      await page.waitForFunction(() => document.querySelector("[data-mini-program]").getAttribute("aria-expanded") === "false");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      await trigger.click();
      await dialog.click({ position: { x: 8, y: 8 } });
      assert.equal(await dialog.isVisible(), true, "clicking dialog padding should not dismiss it");
      await page.mouse.click(2, 2);
      assert.equal(await dialog.isVisible(), false, "clicking the backdrop should dismiss it");
      assert.deepEqual(errors, []);
      console.log(`PASS mini program entry, copy, focus and layout: ${filename} ${width}px`);
      await page.close();
    }
  }
  for (const mode of ["denied", "missing", "failure"]) {
    const page = await openPage("player.html", 390, mode);
    await page.locator("[data-mini-program]").click();
    await page.getByRole("button", { name: "复制口令", exact: true }).click();
    const expected = mode === "failure" ? "自动复制不可用" : "口令已复制";
    await page.waitForFunction((expected) => document.querySelector("#miniProgramStatus").textContent === expected, expected);
    if (mode !== "failure") assert.equal(await page.evaluate(() => window.__copiedMiniProgram), token);
    else assert.equal(await page.locator("#miniProgramCode").evaluate((field) =>
      document.activeElement === field && field.selectionEnd - field.selectionStart === field.value.length), true);
    assert.equal(await page.getByRole("button", { name: "复制口令", exact: true }).isEnabled(), true);
    console.log(`PASS clipboard fallback: ${mode}`);
    await page.close();
  }
} finally {
  await browser.close();
}
