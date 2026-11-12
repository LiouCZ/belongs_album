import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json")) : createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const qrContacts = [
  { selector: "[data-wechat-contact]", name: "BELONGS-OFFICIAL", id: "officialWechatQr", width: 412, height: 416,
    alt: "BELONGS-OFFICIAL 官方微信二维码", asset: "assets/contact/official-wechat.png", original: process.env.WECHAT_ORIGINAL_IMAGE },
  { selector: "[data-wechat-account]", name: "BELONGS OFFICIAL", id: "officialWechatAccountQr", width: 1086, height: 1164,
    alt: "BELONGS OFFICIAL 微信公众号二维码", asset: "assets/contact/official-wechat-account.jpg", original: process.env.WECHAT_ACCOUNT_ORIGINAL_IMAGE },
];

async function openPage(filename, width, touch = false) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: touch, reducedMotion: "reduce" });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`file://${path.join(root, filename)}`);
  if (filename.startsWith("index.html")) await page.locator("#closeIntro").click();
  return { page, errors };
}

async function checkPanel(page, trigger, panel, contact) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await panel.waitFor({ state: "visible" });
  assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  assert.equal(await trigger.getAttribute("aria-controls"), await panel.getAttribute("id"));
  const image = panel.getByRole("img", { name: contact.alt, exact: true });
  await image.evaluate((node) => node.decode());
  assert.equal(await image.evaluate((node, contact) => node.naturalWidth === contact.width && node.naturalHeight === contact.height, contact), true);
  assert.equal(await panel.evaluate((node, contact) => {
    const box = node.getBoundingClientRect();
    const image = node.querySelector("img").getBoundingClientRect();
    return box.left >= 12 && box.right <= innerWidth - 12 && box.top >= 12 && box.bottom <= innerHeight - 12
      && image.width >= 190 && Math.abs(image.width / image.height - contact.width / contact.height) < 0.001
      && document.documentElement.scrollWidth <= innerWidth;
  }, contact), true, "the complete QR must stay readable, proportional and inside the viewport");
}

try {
  for (const filename of ["index.html", "index.html?view=list", "player.html", "brand-story.html"]) {
    for (const width of [320, 390, 768, 1440]) {
      const { page, errors } = await openPage(filename, width);
      const info = page.locator(".brand-public-info");
      for (const contact of qrContacts) {
        const trigger = info.getByRole("button", { name: contact.name, exact: true });
        assert.equal(await trigger.count(), 1, "add a separate official WeChat contact button");
        assert.match(await info.innerText(), /微信公众号\s+BELONGS OFFICIAL/);
        assert.match(await info.innerText(), /官方微信\s+BELONGS-OFFICIAL/);
        const panel = page.locator(`#${contact.id}`);
        assert.equal(await panel.getAttribute("role"), "tooltip");
        assert.equal(await panel.isVisible(), false);
        await trigger.hover();
        await checkPanel(page, trigger, panel, contact);
        await panel.hover();
        await page.waitForTimeout(250);
        assert.equal(await panel.isVisible(), true, "moving from the ID to the QR must keep it open");
        if (process.env.WECHAT_SCREENSHOT_DIR && [390, 1440].includes(width)) {
          mkdirSync(process.env.WECHAT_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.WECHAT_SCREENSHOT_DIR,
            `${contact.id}-${filename.replace(/[.?=]/g, "-")}-${width}.png`) });
        }
        await page.mouse.move(2, 2);
        await panel.waitFor({ state: "hidden" });
        assert.equal(await trigger.getAttribute("aria-expanded"), "false");
        await page.keyboard.press("Tab");
        await trigger.focus();
        await checkPanel(page, trigger, panel, contact);
        assert.equal(await trigger.evaluate((node) => getComputedStyle(node).outlineStyle !== "none"), true);
        await page.keyboard.press("Escape");
        await panel.waitFor({ state: "hidden" });
        assert.equal(await trigger.evaluate((node) => document.activeElement === node), true);
        await page.locator("[data-mini-program]").focus();
        await trigger.focus();
        await checkPanel(page, trigger, panel, contact);
        await page.keyboard.press("Tab");
        await panel.waitFor({ state: "hidden" });
      }
      await page.locator(qrContacts[0].selector).hover();
      await page.locator(qrContacts[1].selector).hover();
      await page.locator(`#${qrContacts[0].id}`).waitFor({ state: "hidden" });
      await checkPanel(page, page.locator(qrContacts[1].selector), page.locator(`#${qrContacts[1].id}`), qrContacts[1]);
      await page.keyboard.press("Escape");
      if (filename === "brand-story.html" && width === 320) {
        await page.locator(".brand-headspot").first().focus();
        await page.locator(qrContacts[1].selector).focus();
        await checkPanel(page, page.locator(qrContacts[1].selector), page.locator(`#${qrContacts[1].id}`), qrContacts[1]);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS WeChat hover, focus, Escape, layout and image: ${filename} ${width}px`);
      await page.close();
    }
  }
  for (const filename of ["index.html", "player.html", "brand-story.html"]) {
    const { page, errors } = await openPage(filename, 390, true);
    for (const contact of qrContacts) {
      await page.setViewportSize({ width: 390, height: 900 });
      const trigger = page.getByRole("button", { name: contact.name, exact: true });
      const panel = page.locator(`#${contact.id}`);
      await trigger.tap();
      await checkPanel(page, trigger, panel, contact);
      await trigger.tap();
      await panel.waitFor({ state: "hidden" });
      await trigger.tap();
      await checkPanel(page, trigger, panel, contact);
      await page.touchscreen.tap(2, 2);
      await panel.waitFor({ state: "hidden" });
      await trigger.tap();
      await page.setViewportSize({ width: 320, height: 600 });
      await page.waitForFunction((id) => {
        const box = document.getElementById(id).getBoundingClientRect();
        return box.left >= 12 && box.right <= innerWidth - 12 && box.bottom <= innerHeight - 12;
      }, contact.id);
      await checkPanel(page, trigger, panel, contact);
      await page.evaluate(() => window.scrollTo(0, window.scrollY > 150 ? 0 : 250));
      await panel.waitFor({ state: "hidden" });
    }
    assert.deepEqual(errors, []);
    console.log(`PASS WeChat touch toggle, outside tap, resize and scroll dismissal: ${filename}`);
    await page.close();
  }
  for (const contact of qrContacts) {
    if (!contact.original) continue;
    assert.deepEqual(readFileSync(path.join(root, contact.asset)),
      readFileSync(contact.original), "the QR asset must preserve the supplied original bytes");
    console.log("PASS QR original image preserved unchanged");
  }
} finally {
  await browser.close();
}
