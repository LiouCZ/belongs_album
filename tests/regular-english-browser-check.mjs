import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("belongs:intro-seen", "1"));
    await page.goto(`file://${path.join(root, "index.html")}?lang=en`);
    const result = await page.evaluate(() => {
      const regular = state.groups.filter((group) => group.releaseType === "regular");
      openDetail(regular[0]);
      const failures = [];
      for (const group of regular) {
        const copy = workCopy(group);
        renderDetailCopy(group);
        if (/[\u3400-\u9fff]/u.test(copy.title + copy.caption)) failures.push(`${group.id}: untranslated content`);
        if (els.detailTitle.textContent !== copy.title) failures.push(`${group.id}: changed heading`);
        if (els.detailCaption.textContent !== (copy.caption || "No description")) failures.push(`${group.id}: changed caption`);
        const container = els.detailCaption.getBoundingClientRect();
        const nodes = [els.detailTitle, els.detailCaption, ...els.detailCaption.querySelectorAll("p, dt, dd, h4, .reading-item")];
        for (const node of nodes) {
          const box = node.getBoundingClientRect();
          if (node.scrollWidth > node.clientWidth + 1 || (node !== els.detailTitle && (box.left < container.left - 1 || box.right > container.right + 1))) {
            failures.push(`${group.id}: ${node.className || node.tagName} overflow`);
            break;
          }
        }
      }
      closeDetail();
      for (const article of state.articles.values()) {
        openArticle(article.id);
        const copies = [...els.articleBody.querySelectorAll(".reading-copy")];
        if (copies.some((copy, index) => copy.textContent !== translatedWork(article.works[index], "description", article.works[index].description))) {
          failures.push(`${article.id}: changed full-article description`);
        }
        if (/[\u3400-\u9fff]/u.test(els.articleBody.textContent)) failures.push(`${article.id}: untranslated full article`);
        if (article.theme && els.articleBody.querySelector(".article-theme-text")?.textContent !== articleTheme(article)) failures.push(`${article.id}: missing closing theme`);
        for (const node of els.articleBody.querySelectorAll("p, h3, dt, dd, blockquote")) {
          if (node.scrollWidth > node.clientWidth + 1) failures.push(`${article.id}: full-article overflow`);
        }
        els.articleDialog.close();
      }
      const example = regular.find((group) => group.items[0].workId === "legacy:2023-002-733543a278");
      openDetail(example);
      if (!els.detailCaption.querySelector(".reading-verse")) failures.push("poetry lost its verse structure");
      closeDetail();
      const first = regular[0].items[0];
      if (translatedWork(first, "title", `${first.title}changed`) !== `${first.title}changed`) failures.push("changed source reused stale English");
      return { count: regular.length, articles: state.articles.size, failures };
    });
    assert.equal(result.count, 772);
    assert.equal(result.failures.length, 0, `${width}px English reading audit (${result.failures.length} failures):\n${result.failures.slice(0, 15).join("\n")}`);
    if (process.env.REGULAR_EN_SCREENSHOTS) {
      await mkdir(process.env.REGULAR_EN_SCREENSHOTS, { recursive: true });
      for (const id of ["2022-067-310f0b46de", "2023-002-733543a278", "2026-002-814025bed3"]) {
        await page.evaluate((id) => openDetail(state.groups.find((group) => group.items.some((item) => item.id === id))), id);
        await page.waitForFunction(() => els.detailImage.complete && els.detailImage.naturalWidth > 0);
        await page.screenshot({ path: path.join(process.env.REGULAR_EN_SCREENSHOTS, `${id}-${width}.png`) });
        await page.evaluate(() => closeDetail());
      }
      await page.screenshot({ path: path.join(process.env.REGULAR_EN_SCREENSHOTS, `gallery-${width}.png`) });
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${result.count} English details and ${result.articles} full articles: ${width}px, original text structure, themes, no Chinese or overflow`);
  }
} finally { await browser.close(); }
