import assert from "node:assert/strict";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, "../album_source/entries");
const entries = [];
for (const name of (await readdir(source)).filter((name) => name.endsWith(".json"))) {
  entries.push(...JSON.parse(await readFile(path.join(source, name), "utf8")));
}
const byId = new Map(entries.map((entry) => [entry.id, entry]));
const history = JSON.parse(await readFile(path.join(root, "data/items.json"), "utf8"));
const curated = JSON.parse(await readFile(path.join(root, "data/curated-official.json"), "utf8"));
const items = [...history.items, ...curated.items];
for (const item of items) {
  const entry = byId.get(item.workId);
  const expected = ["gold", "antique"].filter((stamp) => entry.coverStamps?.includes(stamp));
  assert.deepEqual(item.coverStamps || [], expected, `${item.id}: generated tags must match canonical facts`);
  assert.equal(item.coverStampPosition, expected.length ? entry.coverStampPosition : undefined);
}
for (const [id, expected] of [
  ["upload:2026-custom-gold-opal-coin", ["gold"]],
  ["upload:2026-custom-gold-wing-ring", ["gold"]],
  ["upload:2022-invited-gold-b-ring", ["gold"]],
  ["upload:2025-invited-gold-c-feather", ["gold"]],
  ["upload:2026-display-antique-plate", ["antique"]],
  ["upload:2026-display-antique-snake-feather", ["antique"]],
  ["legacy:2021-210-dc3c222d58", ["gold"]],
  ["legacy:2021-364-326b2f9297", ["antique"]],
  ["wechat:3E-K4wxH146_V9z49av25A:12", ["gold"]],
  ["upload:2026-xianjin-wing", []],
  ["upload:2025-invited-snake-chain", []],
  ["upload:2026-invited-goldtip-chuxin-feather", []],
  ["upload:2026-jinshe-chuxin-feather", []],
  ["upload:2026-custom-goldtip-snake-chuxin-feather", []],
  ["wechat:DdwT0oJaKUtboMoAnPo6Ng:02", []],
  ["legacy:2021-173-24c8bda878", []],
  ["legacy:2022-072-374470c8cb", []],
]) assert.deepEqual(byId.get(id).coverStamps || [], expected, `${id}: verified material and antique provenance must control eligibility`);

const tagged = entries.filter((entry) => entry.coverStamps?.length);
assert.ok(tagged.every((entry) => entry.reviewNotes?.trim()), "tag decisions need retained verification evidence");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const width of [1440, 390, 320]) {
    for (const view of ["grid", "list"]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`file://${path.join(root, "index.html")}?view=${view}`);
      if (await page.locator("#closeIntro").isVisible()) await page.locator("#closeIntro").click();
      const count = await page.evaluate(() => {
        const tagged = state.groups.filter((group) => group.coverStamps.length);
        renderCards(tagged);
        return tagged.length;
      });
      assert.equal(count, tagged.length, "tagging must preserve all existing work groups");
      assert.equal(await page.locator("#gallery .cover-stamps").count(), count);
      for (const card of await page.locator("#gallery .card").all()) {
        await card.scrollIntoViewIfNeeded();
        await card.locator(".thumb > img").evaluate((image) => image.decode());
        assert.equal(await card.evaluate((card) => {
          const frame = card.querySelector(".thumb").getBoundingClientRect();
          const photo = card.querySelector(".thumb > img");
          const box = photo.getBoundingClientRect();
          const stamps = [...card.querySelectorAll(".cover-stamp")].map((node) => node.getBoundingClientRect());
          return getComputedStyle(photo).objectFit === "contain" && box.left >= frame.left - 1 && box.right <= frame.right + 1
            && stamps.every((stamp) => stamp.width > 0 && stamp.left >= frame.left && stamp.right <= frame.right + 1 && stamp.top >= frame.top && stamp.bottom <= frame.bottom + 1);
        }), true, `${width}px ${view}: ${await card.getAttribute("data-id")} cover must remain complete`);
      }
      await page.evaluate(async () => {
        for (const src of ["assets/cover-stamps/gold-work-stamp.png", "assets/cover-stamps/antique-rework-stamp.png"]) {
          const image = new Image();
          image.src = src;
          await image.decode();
          if (image.naturalWidth !== 640 || image.naturalHeight !== 640) throw new Error(`Invalid stamp asset: ${src}`);
        }
      });
      if (process.env.STAMP_SCREENSHOT_DIR) {
        await mkdir(process.env.STAMP_SCREENSHOT_DIR, { recursive: true });
        // Keep the sticky navigation outside the isolated gallery capture.
        await page.addStyleTag({ content: ".site-nav { visibility: hidden !important; }" });
        if (width === 1440 && view === "grid") {
          for (let offset = 0; offset < count; offset += 16) {
            await page.evaluate((offset) => renderCards(state.groups.filter((group) => group.coverStamps.length).slice(offset, offset + 16)), offset);
            for (const img of await page.locator("#gallery .thumb > img").all()) {
              await img.scrollIntoViewIfNeeded();
              await img.evaluate((node) => node.decode());
            }
            await page.locator("#gallery").screenshot({ path: path.join(process.env.STAMP_SCREENSHOT_DIR, `catalog-${offset}.png`) });
          }
        } else {
          await page.evaluate(() => renderCards(state.groups.filter((group) => ["upload:2026-custom-gold-opal-coin", "upload:2026-display-antique-plate", "legacy:2021-364-326b2f9297", "wechat:3E-K4wxH146_V9z49av25A:12"].includes(group.items[0].workId))));
          for (const img of await page.locator("#gallery .thumb > img").all()) {
            await img.scrollIntoViewIfNeeded();
            await img.evaluate((node) => node.decode());
          }
          await page.locator("#gallery").screenshot({ path: path.join(process.env.STAMP_SCREENSHOT_DIR, `actual-${width}-${view}.png`) });
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS ${count} real stamped covers ${width}px ${view}`);
    }
  }
  console.log(`Verified tags: gold=${tagged.filter((entry) => entry.coverStamps.includes("gold")).length}, antique=${tagged.filter((entry) => entry.coverStamps.includes("antique")).length}`);
} finally {
  await browser.close();
}
