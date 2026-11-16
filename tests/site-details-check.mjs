import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
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

async function openPage(browser, filename, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(5000);
  await page.clock.install({ time: new Date("2026-10-22T12:00:00") });
  await page.goto(`file://${path.join(root, filename)}`);
  if (filename.startsWith("index.html")) await page.locator("#closeIntro").click();
  return page;
}

async function checkStampAppearance(page) {
  const dialog = page.locator("#siteEggDialog");
  assert.equal(await dialog.evaluate((node) => {
    const style = getComputedStyle(node);
    const header = node.querySelector(".site-egg-header");
    const close = header.querySelector("button");
    const closeStyle = getComputedStyle(close);
    const closeBox = close.getBoundingClientRect();
    const quote = node.querySelector(".site-egg-quote");
    const quoteStyle = getComputedStyle(quote);
    const citationStyle = getComputedStyle(quote.querySelector("cite"));
    const discovery = node.querySelector(".discovery-strip");
    return style.borderRadius === "8px" && style.borderTopColor === "rgba(244, 241, 234, 0.24)"
      && style.boxShadow !== "none" && style.backgroundColor === "rgb(95, 105, 107)"
      && closeStyle.borderTopWidth === "0px" && closeBox.width >= 44 && closeBox.height >= 44
      && quoteStyle.backgroundColor === "rgb(244, 241, 234)" && parseFloat(quoteStyle.paddingTop) >= 24
      && parseFloat(citationStyle.fontSize) < parseFloat(getComputedStyle(quote.querySelector("p")).fontSize)
      && (!discovery || getComputedStyle(discovery).borderBottomWidth === "0px");
  }), true, "the stamp uses a soft outline, a borderless usable close button, an airy quotation and no trailing divider");
  assert.equal(await dialog.locator(".discovery-pick, .discovery-trace-item").evaluateAll((items) =>
    items.every((item) => getComputedStyle(item).borderTopWidth === "0px"
      && getComputedStyle(item).borderRadius === "6px")), true,
  "work entries are lightweight image-and-text links, not nested outlined boxes");
  assert.equal(await dialog.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return box.left >= 12 && box.right <= innerWidth - 12 && box.top >= 8 && box.bottom <= innerHeight - 8
      && node.scrollWidth <= node.clientWidth && document.documentElement.scrollWidth <= innerWidth
      && [...node.querySelectorAll(".site-egg-header, .site-egg-quote, .discovery-label, strong, small")]
        .every((item) => item.scrollWidth <= item.clientWidth + 1);
  }), true, "the stamp and all text must fit the viewport without horizontal clipping");
  const close = dialog.getByRole("button", { name: "关闭印记" });
  await page.keyboard.press("Tab");
  await close.focus();
  assert.equal(await close.evaluate((node) => getComputedStyle(node).outlineStyle !== "none"), true,
    "the borderless close button retains a visible keyboard focus ring");
  const works = dialog.locator(".discovery-pick, .discovery-trace-item");
  for (const work of await works.all()) {
    await work.focus();
    assert.equal(await work.evaluate((node) => getComputedStyle(node).outlineStyle !== "none"), true,
      "lightweight work entries retain visible keyboard focus");
  }
  const trace = dialog.locator(".discovery-trace");
  if (await trace.count()) await trace.evaluate((node) => { node.scrollLeft = 0; });
  await dialog.locator(".site-egg-header span").click();
  if (process.env.STAMP_SCREENSHOT_DIR) {
    mkdirSync(process.env.STAMP_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.STAMP_SCREENSHOT_DIR,
      `${path.basename(new URL(page.url()).pathname)}-${page.viewportSize().width}.png`) });
  }
}

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath });
  try {
    const home = await openPage(browser, "index.html");
    assert.equal(await home.locator(".discovery-strip").isVisible(), false);
    const eggTrigger = home.locator("#siteEggTrigger");
    assert.equal(await eggTrigger.isVisible(), true);
    await eggTrigger.click();
    assert.equal(await home.locator("#siteEggDialog").isVisible(), true);
    await checkStampAppearance(home);
    const daily = home.locator("#dailyPick");
    assert.ok((await daily.locator("strong").textContent()).trim());
    const firstDailyId = await daily.getAttribute("data-discovery-id");
    const firstQuote = await home.locator(".site-egg-quote p").textContent();
    await home.locator(".site-egg-header button").click();
    await eggTrigger.click();
    assert.notEqual(await daily.getAttribute("data-discovery-id"), firstDailyId);
    assert.notEqual(await home.locator(".site-egg-quote p").textContent(), firstQuote);
    assert.match(await home.locator("#timeTraceLabel").textContent(), /往年今日.*10月22日/);
    assert.match(await home.locator("#timeTrace").textContent(), /余生很长，何必慌张/);
    await daily.click();
    assert.equal(await home.locator("#detailDialog").isVisible(), true);
    assert.equal(await home.locator("#siteEggDialog").isVisible(), false);
    await home.locator("#closeDialog").click();
    await home.reload();
    assert.equal(await home.locator("#introDialog").isVisible(), false);
    await home.locator("#siteEggTrigger").click();
    await home.locator("#timeTrace button").first().click();
    assert.equal(await home.locator("#detailDialog").isVisible(), true);
    await home.close();

    const fallback = await browser.newPage();
    fallback.setDefaultTimeout(5000);
    await fallback.clock.install({ time: new Date("2026-10-23T12:00:00") });
    await fallback.goto(`file://${path.join(root, "index.html")}`);
    await fallback.locator("#closeIntro").click();
    await fallback.locator("#siteEggTrigger").click();
    assert.match(await fallback.locator("#timeTraceLabel").textContent(), /十月旧作/);
    assert.ok(await fallback.locator("#timeTrace button").count() > 0);
    await fallback.close();

    const filtered = await openPage(browser, "index.html?q=%E7%BE%BD%E7%BF%BC");
    assert.equal(await filtered.locator("#searchInput").inputValue(), "羽翼");
    const visible = Number(await filtered.locator("#visibleCount").textContent());
    const total = Number(await filtered.locator("#totalCount").textContent());
    assert.ok(visible > 0 && visible < total);
    await filtered.close();

    const story = await openPage(browser, "brand-story.html");
    const motif = story.locator(".motif-links a", { hasText: "羽翼" });
    assert.equal(await motif.getAttribute("href"), "index.html?q=%E7%BE%BD%E7%BF%BC");
    await motif.click();
    await story.waitForURL(/index\.html\?q=/);
    await story.locator("#closeIntro").click();
    assert.equal(await story.locator("#searchInput").inputValue(), "羽翼");
    await story.close();

    for (const filename of ["index.html", "player.html", "brand-story.html"]) {
      const page = await openPage(browser, filename, { width: 390, height: 844 });
      const brandInfo = page.locator(".brand-public-info");
      assert.match(await brandInfo.innerText(), /小红书号\s+BELONGS/);
      assert.match(await brandInfo.innerText(), /微信公众号\s+BELONGS OFFICIAL/);
      const socialLink = brandInfo.getByRole("link", { name: "小红书：BELONGS（新标签页）", exact: true });
      const socialUrl = "https://www.xiaohongshu.com/user/profile/651a074a00000000240173a2";
      assert.equal(await socialLink.count(), 1, "the official Xiaohongshu account should be a link");
      assert.equal(await socialLink.getAttribute("href"), socialUrl);
      assert.equal(await socialLink.getAttribute("target"), "_blank");
      assert.match(await socialLink.getAttribute("rel"), /\bnoopener\b/);
      assert.match(await socialLink.getAttribute("rel"), /\bnoreferrer\b/);
      assert.equal(await socialLink.evaluate((link) => getComputedStyle(link).color),
        await brandInfo.evaluate((info) => getComputedStyle(info).color), "keep the original account text color");
      const socialValue = socialLink.locator(".brand-contact-value");
      assert.equal(await socialValue.evaluate((node) => getComputedStyle(node).textDecorationLine), "underline");
      await socialLink.hover();
      assert.equal(await socialValue.evaluate((node) => getComputedStyle(node).textDecorationLine), "underline");
      await socialLink.focus();
      assert.equal(await socialLink.evaluate((link) => getComputedStyle(link).outlineStyle !== "none"), true);
      await page.context().route(socialUrl, (route) => route.fulfill({ contentType: "text/html", body: "Official profile destination" }));
      const [profile] = await Promise.all([page.waitForEvent("popup"), socialLink.press("Enter")]);
      await profile.waitForURL(socialUrl);
      assert.equal(await profile.evaluate(() => window.opener === null), true);
      await profile.close();
      assert.equal(await brandInfo.getByRole("link").count(), 4, "Xiaohongshu, Instagram, the mini program and email use links; both WeChat accounts use QR buttons");
      assert.equal(await brandInfo.getByRole("link", { name: "联系邮箱：belongs2019@126.com", exact: true }).getAttribute("href"),
        "mailto:belongs2019@126.com");
      assert.equal(await brandInfo.getByRole("link", { name: "Instagram：@belongs_official（新标签页）", exact: true }).getAttribute("href"),
        "https://www.instagram.com/belongs_official/");
      const trigger = page.locator("#siteEggTrigger");
      assert.equal(await trigger.count(), 1);
      assert.equal(await page.locator(".top-actions > #siteEggTrigger").count(), 1);
      assert.equal(await page.locator(".site-nav > a").count(), 4);
      await trigger.click();
      const egg = page.locator("#siteEggDialog");
      assert.equal(await egg.isVisible(), true);
      await checkStampAppearance(page);
      assert.match(await egg.textContent(), /官方图文《.+》 · 20\d{2}/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.close();
    }

    for (const [randomValue, expectedIndex] of [[0, 0], [0.99, 1]]) {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.addInitScript((value) => { Math.random = () => value; }, randomValue);
      await page.goto(`file://${path.join(root, "brand-story.html")}`);
      assert.equal(await page.locator(".top-actions > *").evaluateAll((children) => children.findIndex((child) => child.id === "siteEggTrigger")), expectedIndex);
      await page.close();
    }

    const narrow = await openPage(browser, "index.html", { width: 320, height: 720 });
    await narrow.locator("#siteEggTrigger").click();
    await checkStampAppearance(narrow);
    assert.equal(await narrow.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const traceLayout = await narrow.locator("#timeTrace").evaluate((trace) => ({
      count: trace.children.length,
      width: trace.firstElementChild.getBoundingClientRect().width,
      clientWidth: trace.clientWidth,
      scrollWidth: trace.scrollWidth,
    }));
    if (traceLayout.count === 1) {
      assert.ok(traceLayout.width > 170, "a single historical work should fill the available row");
    } else {
      assert.ok(traceLayout.width >= 90 && traceLayout.width <= 170, "multiple historical works should use the existing compact carousel");
      if (traceLayout.scrollWidth > traceLayout.clientWidth) {
        await narrow.locator("#timeTrace").evaluate((trace) => { trace.scrollLeft = trace.scrollWidth; });
        assert.ok(await narrow.locator("#timeTrace").evaluate((trace) => trace.scrollLeft > 0));
      } else {
        assert.ok(await narrow.locator("#timeTrace").evaluate((trace) =>
          trace.lastElementChild.getBoundingClientRect().right <= trace.getBoundingClientRect().right));
      }
    }
    await narrow.close();

    for (const filename of ["index.html", "index.html?view=list", "player.html", "brand-story.html"]) {
      for (const [width, height] of [[320, 568], [390, 600], [680, 720], [681, 720], [1440, 900]]) {
        const page = await openPage(browser, filename, { width, height });
        await page.clock.setFixedTime(new Date("2026-11-16T12:00:00"));
        await page.locator("#siteEggTrigger").click();
        await checkStampAppearance(page);
        if (filename.startsWith("index.html")) {
          assert.equal(await page.locator(".discovery-trace-item").count(), 3,
            "check the fallback layout with a full row of three historical works");
        }
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#siteEggDialog").isHidden(), true);
        assert.equal(await page.locator("#siteEggTrigger").evaluate((node) => document.activeElement === node), true,
          "closing the stamp returns keyboard focus to its trigger");
        console.log(`PASS stamp outline, typography, focus, overflow and dismissal: ${filename} ${width}x${height}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
