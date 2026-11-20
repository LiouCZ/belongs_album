import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const routes = ["index.html", "player.html", "brand-story.html", "vip.html", "custom-rules.html"];
try {
  for (const width of [1440, 390, 320]) {
    for (const route of routes) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => { try { localStorage.setItem("belongs:intro-seen", "1"); } catch {} });
      await page.goto(`file://${path.join(root, route)}`);
      assert.equal(await page.locator("#languageSelect").count(), 1, `${route}: shared language selector`);
      assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
      const initial = await page.evaluate(() => ({ images: [...document.querySelectorAll("#gallery .thumb > img")].map((node) => node.getAttribute("src")), form: document.querySelector("#vipForm")?.elements.length }));
      if (route === "vip.html") {
        await page.locator('input[name="称呼"]').fill("Alex 陈");
        await page.locator('label:has(input[name="主件类"][value="L十字"])').click();
      }
      await page.locator("#languageSelect").selectOption("en");
      assert.equal(await page.locator("html").getAttribute("lang"), "en");
      assert.equal(await page.locator('.site-nav a[href*="player.html"]').evaluateAll((nodes) => nodes.every((node) => new URL(node.href).searchParams.get("lang") === "en")), true);
      assert.match(await page.title(), /BELONGS B&K/);
      assert.doesNotMatch(await page.title(), /官方|玩家|故事|定制/);
      assert.equal(new URL(page.url()).searchParams.get("lang"), "en");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} ${width}: no horizontal overflow`);
      assert.deepEqual(await page.locator("#gallery .thumb > img").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src"))), initial.images, "language must not regroup or reorder images");
      assert.equal(await page.locator("#languageSelect").evaluate((node) => {
        const box = node.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth && box.height >= 32;
      }), true, "selector fits the viewport");
      if (route === "vip.html") {
        assert.equal(await page.locator('input[name="称呼"]').inputValue(), "Alex 陈");
        assert.equal(await page.locator('input[name="主件类"][value="L十字"]').isChecked(), true);
        assert.match(await page.locator("#resultText").inputValue(), /Alex 陈/);
        assert.match(await page.locator("#resultText").inputValue(), /L Cross/);
        assert.equal(await page.locator("#vipForm").evaluate((node) => node.elements.length), initial.form);
      }
      if (process.env.I18N_SCREENSHOT_DIR) {
        await page.evaluate(() => scrollTo(0, 0));
        await mkdir(process.env.I18N_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.I18N_SCREENSHOT_DIR, `${route}-${width}-en.png`), fullPage: route === "vip.html" || route === "custom-rules.html" });
      }
      await page.locator("#languageSelect").selectOption("zh");
      assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
      assert.deepEqual(errors, [], `${route}: browser errors`);
      await context.close();
      console.log(`PASS bilingual static page and state: ${route} ${width}px`);
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("belongs:intro-seen", "1"));
  await page.goto(`file://${path.join(root, "player.html")}?lang=en`);
  await page.locator("#nextPage").click();
  const pageTwo = await page.locator("#gallery .card").first().getAttribute("data-id");
  await page.locator("#languageSelect").selectOption("zh");
  assert.equal(await page.locator("#gallery .card").first().getAttribute("data-id"), pageTwo);
  await page.locator("#gallery .card").first().click();
  await page.locator("#nextImage").click();
  const image = await page.locator("#detailImage").getAttribute("src");
  await page.evaluate(() => window.BelongsI18n.setLanguage("en"));
  assert.equal(await page.locator("#detailDialog").evaluate((node) => node.open), true);
  assert.equal(await page.locator("#detailImage").getAttribute("src"), image);
  assert.equal(await page.locator("#carouselCount").textContent(), "2 / 2");
  assert.equal(await page.locator("#detailTitle").textContent(), "Wings #21");
  await page.locator("#closeDialog").click();
  await page.locator("#searchInput").fill("Wings #24");
  const results = await page.locator("#visibleCount").textContent();
  assert.equal(results, "1");
  await page.locator("#languageSelect").selectOption("zh");
  assert.equal(await page.locator("#visibleCount").textContent(), results);
  assert.equal(await page.locator("#searchInput").inputValue(), "Wings #24");
  await page.locator("#languageSelect").selectOption("en");
  await page.goto(`file://${path.join(root, "brand-story.html")}`);
  assert.equal(await page.locator("#languageSelect").inputValue(), "en", "stored preference survives navigation");
  await page.goto(`file://${path.join(root, "index.html")}?release=custom&view=list&lang=zh`);
  assert.equal(await page.locator("#languageSelect").inputValue(), "zh", "URL overrides preference");
  await page.locator("#languageSelect").selectOption("en");
  assert.equal(new URL(page.url()).searchParams.get("release"), "custom");
  assert.equal(new URL(page.url()).searchParams.get("view"), "list");
  await page.locator("#searchInput").fill("L Cross");
  assert.equal(await page.locator("#visibleCount").textContent(), "1");
  assert.equal(await page.locator("#gallery h3").textContent(), "L Cross");
  await page.evaluate(() => {
    const id = "upload:2026-custom-l-cross";
    if (window.BelongsI18n.content("works", id, "title", "Changed title") !== "Changed title") throw new Error("Stale translation used");
  });
  await page.goto(`file://${path.join(root, "index.html")}?lang=en`);
  await page.locator("#siteEggTrigger").click();
  const discoveryId = await page.locator("#dailyPick").getAttribute("data-discovery-id");
  await page.evaluate(() => window.BelongsI18n.setLanguage("zh"));
  assert.equal(await page.locator("#siteEggDialog").evaluate((node) => node.open), true);
  assert.equal(await page.locator("#dailyPick").getAttribute("data-discovery-id"), discoveryId);
  await page.evaluate(() => window.BelongsI18n.setLanguage("en"));
  assert.equal(await page.locator("#dailyPick").getAttribute("data-discovery-id"), discoveryId);
  assert.doesNotMatch(await page.locator(".site-egg-quote p").textContent(), /[\u3400-\u9fff]/u);
  await page.locator(".site-egg-header button").click();
  await page.locator("#siteEggTrigger").click();
  assert.notEqual(await page.locator("#dailyPick").getAttribute("data-discovery-id"), discoveryId);
  await page.locator(".site-egg-header button").click();
  await page.evaluate(() => openArticle(state.articles.keys().next().value));
  const articleImages = await page.locator("#articleBody img").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
  await page.evaluate(() => window.BelongsI18n.setLanguage("zh"));
  assert.equal(await page.locator("#articleDialog").evaluate((node) => node.open), true);
  assert.deepEqual(await page.locator("#articleBody img").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src"))), articleImages);
  await context.close();
  const blocked = await browser.newContext();
  const blockedPage = await blocked.newPage();
  await blockedPage.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } }));
  await blockedPage.goto(`file://${path.join(root, "player.html")}?lang=en`);
  assert.equal(await blockedPage.locator("#languageSelect").inputValue(), "en");
  await blockedPage.locator("#languageSelect").selectOption("zh");
  assert.equal(await blockedPage.locator("html").getAttribute("lang"), "zh-CN");
  await blocked.close();
  console.log("PASS language preference, URL override, blocked storage, bilingual search, stale-source fallback, page and carousel state");
} finally { await browser.close(); }
