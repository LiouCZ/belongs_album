import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
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
const description = "以解构东方美学为核，将金银淬炼为当代艺术语言，每件作品皆是文化符号与先锋美学的碰撞。熔铸光阴的温度，让创作成为永恒契约。";
const socialUrl = "https://www.xiaohongshu.com/user/profile/651a074a00000000240173a2";
const instagramUrl = "https://www.instagram.com/belongs_official/";
const emailAddress = "belongs2019@126.com";

try {
  for (const filename of ["index.html", "index.html?view=list", "player.html", "brand-story.html"]) {
    for (const width of [320, 360, 390, 430, 580, 581, 768, 900, 901, 1024, 1100, 1101, 1279, 1280, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`file://${path.join(root, filename)}`);
      assert.equal(await page.locator("header.album-header").count(), 1,
        "all three pages use the same compact album masthead");
      assert.equal(await page.locator(".brand h1").textContent(), "BELONGS B&K");
      assert.equal(await page.locator(".topbar .brand-public-info").count(), 1);
      const instagram = page.locator(".brand-public-info").getByRole("link", { name: "Instagram：@belongs_official（新标签页）", exact: true });
      assert.equal(await instagram.count(), 1, "each shared header should include the official Instagram profile");
      assert.equal(await instagram.getAttribute("href"), instagramUrl);
      assert.equal(await instagram.getAttribute("target"), "_blank");
      assert.match(await instagram.getAttribute("rel"), /\bnoopener\b/);
      assert.match(await instagram.getAttribute("rel"), /\bnoreferrer\b/);
      assert.equal(await instagram.locator(".brand-contact-value").textContent(), "@belongs_official");
      assert.equal(await instagram.locator(".brand-contact-cue").count(), 1);
      const email = page.locator(".brand-public-info").getByRole("link", { name: `联系邮箱：${emailAddress}`, exact: true });
      assert.equal(await email.count(), 1, "each shared header should include the contact email");
      assert.equal(await email.getAttribute("href"), `mailto:${emailAddress}`);
      assert.equal(await email.getAttribute("target"), null, "email should use the system mail handler, not a blank browser tab");
      assert.equal(await email.locator(".brand-contact-value").textContent(), emailAddress);
      assert.equal(await email.locator(".brand-contact-icon").getAttribute("src"), "assets/icons/mail.svg");
      assert.equal(await email.locator(".brand-contact-value").evaluate((node) => getComputedStyle(node).textDecorationLine), "underline");
      if (filename.startsWith("index.html")) {
        await page.locator("#closeIntro").click();
        assert.equal(await page.title(), "BELONGS B&K | 官方画册");
        assert.equal(await page.locator(".brand-description").textContent(), description);
        assert.equal(await page.locator(".brand .brand-description").count(), 1,
          "the introduction belongs directly below the home brand name");
        assert.equal(await page.locator(".brand .brand-public-info").count(), 0,
          "official accounts remain separate from the heading copy");
        assert.equal(await page.getByText("官方画册 · 2021-2026 公众号合集", { exact: true }).count(), 0);
        assert.equal(await page.locator("body > .brand-overview, main .brand-overview").count(), 0,
          "do not leave a separate introduction in the content area");
      }
      assert.equal(await page.locator(".brand").evaluate((brand) => {
        const mark = brand.querySelector(".brand-mark").getBoundingClientRect();
        const text = brand.querySelector(innerWidth <= 580 ? "h1" : ".brand-copy").getBoundingClientRect();
        return Math.abs((mark.top + mark.bottom) / 2 - (text.top + text.bottom) / 2) < 1;
      }), true, "center the logo beside the complete desktop text block, or the title on mobile");
      assert.equal(await page.locator(".topbar").evaluate((header) => {
        const box = header.getBoundingClientRect();
        const brand = header.querySelector(".brand").getBoundingClientRect();
        const title = header.querySelector("h1").getBoundingClientRect();
        const description = header.querySelector(".brand-description").getBoundingClientRect();
        const mark = header.querySelector(".brand-mark").getBoundingClientRect();
        const rail = header.querySelector(".brand-overview").getBoundingClientRect();
        const navigationNode = document.querySelector(".top-actions");
        const navigation = navigationNode.getBoundingClientRect();
        const links = [...navigationNode.querySelectorAll(".site-nav a")].map((node) => node.getBoundingClientRect());
        const contacts = [...header.querySelectorAll(".brand-contact")].map((node) => node.getBoundingClientRect());
        const same = (a, b) => Math.abs(a - b) < 1;
        return getComputedStyle(header).position === "static" && mark.height <= 78 && mark.width <= 44
          && mark.right < title.left && description.top >= title.bottom + 6
          && same(description.left, innerWidth <= 580 ? brand.left : title.left)
          && (innerWidth <= 900 ? same(rail.left, brand.left) && rail.width >= brand.width
            && rail.top >= brand.bottom + 8 : rail.left >= brand.right + 20 && same(rail.top, brand.top))
          && navigation.top >= Math.max(brand.bottom, rail.bottom) + 8
          && same(navigation.left + parseFloat(getComputedStyle(navigationNode).paddingLeft), brand.left)
          && navigation.right >= rail.right
          && Boolean(header.querySelector(".brand-overview").compareDocumentPosition(navigationNode) & Node.DOCUMENT_POSITION_FOLLOWING)
          && links.every((link) => same(link.top, links[0].top) && link.height >= (innerWidth <= 580 ? 44 : 32))
          && contacts.every((contact) => same(contact.width, contacts[0].width))
          && [0, 2, 4].every((index) => same(contacts[index].top, contacts[index + 1].top)
            && same(contacts[index].left, contacts[0].left) && same(contacts[index + 1].left, contacts[1].left))
          && contacts[2].top >= contacts[0].bottom + 7 && contacts[4].top >= contacts[2].bottom + 7
          && (innerWidth > 580 || navigation.bottom - box.top <= 402)
          && (innerWidth < 1024 || navigation.bottom - box.top <= 262);
      }), true, "accounts accompany the brand above the full-width page navigation on phones and desktop");
      assert.equal(await email.evaluate((node) => {
        const label = node.querySelector(".brand-contact-label").getBoundingClientRect();
        const value = node.querySelector(".brand-contact-value").getBoundingClientRect();
        const style = getComputedStyle(node);
        return Math.abs(label.left - value.left) < 1 && value.top >= label.bottom + 3
          && value.height <= 19 && value.right <= node.getBoundingClientRect().right + 1
          && style.borderTopWidth === "0px" && style.borderBottomWidth === "0px"
          && style.backgroundColor === "rgba(0, 0, 0, 0)";
      }), true, "email follows the same label/value layout and stays complete on one line without a frame or button fill");
      const overview = page.locator(".brand-overview");
      const contacts = overview.locator(".brand-public-info");
      assert.equal(await contacts.locator(".brand-contact").count(), 6);
      assert.deepEqual(await contacts.locator(".brand-contact-label").allTextContents(),
        ["小红书号", "Instagram", "微信公众号", "微信小程序", "官方微信", "联系邮箱"],
        "group public profiles, WeChat content/services and direct contacts in three paired rows");
      const social = contacts.getByRole("link", { name: "小红书：BELONGS（新标签页）", exact: true });
      assert.equal(await social.getAttribute("href"), socialUrl);
      assert.equal(await social.getAttribute("target"), "_blank");
      assert.match(await social.getAttribute("rel"), /noopener/);
      assert.equal(await social.locator(".brand-contact-value").evaluate((node) => getComputedStyle(node).textDecorationLine), "underline",
        "Xiaohongshu needs a visible link cue before hover");
      assert.equal(await social.locator(".brand-contact-cue").count(), 1);
      assert.equal(await contacts.locator("[data-wechat-contact] .brand-contact-cue").count(), 1);
      assert.equal(await contacts.getByRole("button", { name: "BELONGS OFFICIAL", exact: true }).count(), 1);
      assert.equal(await contacts.locator("[data-wechat-account] .brand-contact-cue").count(), 1);
      assert.equal(await contacts.getByRole("link", { name: "微信小程序：BELONGS B&K（新标签页）", exact: true }).count(), 1);
      assert.equal(await contacts.getByText("BELONGS OFFICIAL", { exact: true }).count(), 1);
      const icons = contacts.locator("img");
      assert.equal(await icons.count(), 11);
      for (const icon of await icons.all()) {
        await icon.evaluate((node) => node.decode());
        assert.equal(await icon.getAttribute("alt"), "");
      }
      assert.equal(await overview.evaluate((node) => {
        const contacts = [...node.querySelectorAll(".brand-contact")].map((item) => item.getBoundingClientRect());
        const elements = [...node.querySelectorAll(".brand-contact-value, .brand-contact-label, .brand-description")];
        const box = node.getBoundingClientRect();
        const header = document.querySelector(".topbar").getBoundingClientRect();
        const main = document.querySelector("main").getBoundingClientRect();
        const inHeader = Boolean(node.closest(".topbar"));
        return document.documentElement.scrollWidth <= innerWidth && box.bottom <= main.top + 1
          && (inHeader ? box.top >= header.top && box.bottom <= header.bottom : box.top >= header.bottom - 1)
          && contacts.every((item, index) => item.left >= 0 && item.right <= innerWidth && item.height >= 44
            && contacts.slice(index + 1).every((other) => item.right <= other.left + 1 || other.right <= item.left + 1
              || item.bottom <= other.top + 1 || other.bottom <= item.top + 1))
          && elements.every((item) => item.scrollWidth <= item.clientWidth + 1 && item.scrollHeight <= item.clientHeight + 1);
      }), true, "introduction, contacts and content must fit without clipping or overlap");
      assert.equal(await overview.evaluate((node) => getComputedStyle(node).backgroundColor),
        "rgba(0, 0, 0, 0)", "the account rail inherits the existing header palette");
      await social.focus();
      assert.equal(await social.evaluate((node) => getComputedStyle(node).outlineStyle !== "none"), true);
      await email.focus();
      assert.equal(await email.evaluate((node) => document.activeElement === node
        && getComputedStyle(node).outlineStyle !== "none"), true, "email must have visible keyboard focus");
      await instagram.focus();
      assert.equal(await instagram.evaluate((node) => document.activeElement === node
        && getComputedStyle(node).outlineStyle !== "none"), true, "Instagram must have visible keyboard focus");
      if (process.env.BRAND_HEADER_SCREENSHOT_DIR && [320, 390, 1440].includes(width)) {
        mkdirSync(process.env.BRAND_HEADER_SCREENSHOT_DIR, { recursive: true });
        await page.mouse.click(2, 2);
        await page.screenshot({ path: path.join(process.env.BRAND_HEADER_SCREENSHOT_DIR,
          `brand-header-${filename.replace(/[.?=]/g, "-")}-${width}.png`) });
      }
      if (width === 1440 && filename === "index.html") {
        for (const [link, url] of [[social, socialUrl], [instagram, instagramUrl]]) {
          await page.context().route(url, (route) => route.fulfill({ contentType: "text/html", body: "Official profile" }));
          const [profile] = await Promise.all([page.waitForEvent("popup"), link.click()]);
          await profile.waitForURL(url);
          assert.equal(await profile.evaluate(() => window.opener === null), true);
          await profile.close();
        }
        await page.evaluate(() => window.scrollBy(0, 600));
        assert.ok((await overview.boundingBox()).y + (await overview.boundingBox()).height <= 0,
          "the brand introduction and social entries should scroll out of the way");
        assert.equal(await page.locator(".topbar").evaluate((node) => getComputedStyle(node).position), "static",
          "the taller home header must not obscure album content while scrolling");
      }
      assert.deepEqual(errors, []);
      console.log(`PASS brand header, description, social cues, icons and responsive layout: ${filename} ${width}px`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
