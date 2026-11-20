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
    for (const route of ["index.html", "player.html"]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      await page.addInitScript(() => localStorage.setItem("belongs:intro-seen", "1"));
      await page.goto(`file://${path.join(root, route)}?lang=en`);
      const count = await page.evaluate(() => {
        const groups = state.groups.filter((group) => document.querySelector("#playerAlbum") || group.items[0].workId?.startsWith("upload:"));
        for (const group of groups) {
          openDetail(group);
          const copy = workCopy(group);
          if (els.detailTitle.textContent !== copy.title || els.detailCaption.textContent !== copy.caption) throw new Error(`${group.id}: changed translation`);
          if (/[\u3400-\u9fff]/u.test(copy.title + copy.caption)) throw new Error(`${group.id}: missing translation`);
          const nodes = [els.dialog, els.detailTitle, els.detailCaption, ...els.detailCaption.querySelectorAll("p, dt, dd")];
          if (nodes.some((node) => node.scrollWidth > node.clientWidth + 1)) throw new Error(`${group.id}: detail overflow`);
          closeDetail();
        }
        return groups.length;
      });
      assert.equal(count, route === "index.html" ? 17 : 30);
      await page.evaluate(() => openDetail(state.groups.find((group) => group.items[0].workId === "upload:2026-custom-goldtip-snake-chuxin-feather") || state.groups.find((group) => group.title === "羽翼 #21")));
      await page.waitForFunction(() => els.detailImage.complete && els.detailImage.naturalWidth > 0);
      if (process.env.I18N_SCREENSHOT_DIR) {
        await mkdir(process.env.I18N_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.I18N_SCREENSHOT_DIR, `${route}-detail-${width}-en.png`) });
      }
      await page.close();
      console.log(`PASS ${count} translated detail layouts: ${route} ${width}px`);
    }
  }
} finally { await browser.close(); }
