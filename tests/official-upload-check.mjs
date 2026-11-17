import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const works = [
  { id: "upload:2026-xianjin-wing", year: "2026", title: "先金羽翼", type: "invited", label: "邀约作品", category: "先金羽翼", images: ["front", "back"], slug: "wing" },
  { id: "upload:2026-jinshe-chuxin-feather", year: "2026", title: "金蛇首初心羽", type: "display", label: "展示作品", category: "初心羽", images: ["01-front-nature", "02-front-mirror", "03-back-mirror", "04-back-detail"], slug: "jinshe-chuxin-feather" },
  { id: "upload:2026-k-key", year: "2026", title: "K 钥匙", type: "personal", label: "自用作品", category: "钥匙", images: ["front", "back"], slug: "k-key" },
  { id: "upload:2026-display-k-key", year: "2026", title: "K钥匙", type: "display", label: "展示作品", category: "钥匙", images: ["01-front", "02-front-chain", "03-back-detail", "04-front-wide", "05-front-detail"], slug: "display-k-key" },
  { id: "upload:2026-custom-l-cross", year: "2026", title: "L十字", type: "custom", label: "定制作品", category: "L十字", images: ["01", "02"], slug: "custom-l-cross" },
  { id: "upload:2026-custom-gold-wing-ring", year: "2026", title: "全金羽翼戒指", type: "custom", label: "定制作品", category: "羽翼戒指", images: ["02", "01", "03"], slug: "custom-gold-wing-ring" },
  { id: "upload:2024-invited-dragon-dog-tag", year: "2024", title: "龙·狗牌", type: "invited", label: "邀约作品", category: "狗牌", images: ["front", "back"], slug: "invited-dragon-dog-tag" },
  { id: "upload:2024-invited-snake-square-tag", year: "2024", title: "蛇·方牌", type: "invited", label: "邀约作品", category: "方牌", images: ["front", "back"], slug: "invited-snake-square-tag" },
  { id: "upload:2022-invited-gold-b-ring", year: "2022", title: "全金B戒", type: "invited", label: "邀约作品", category: "B戒", images: ["front"], slug: "invited-gold-b-ring" },
  { id: "upload:2026-display-antique-plate", year: "2026", title: "古董改造盘子", type: "display", label: "展示作品", category: "盘子", images: ["front"], slug: "display-antique-plate" },
  { id: "upload:2026-custom-goldtip-snake-chuxin-feather", year: "2026", title: "金蛇首先金初心羽", type: "custom", label: "定制作品", category: "初心羽", images: ["02-front", "01-detail", "03-back"], slug: "custom-goldtip-snake-chuxin-feather" },
  { id: "upload:2026-custom-gold-opal-coin", year: "2026", title: "全金镶嵌欧泊小金饼", type: "custom", label: "定制作品", category: "金饼", images: ["front", "back"], slug: "custom-gold-opal-coin" },
  { id: "upload:2026-invited-eagle-square-tag", year: "2025", title: "鹰·方牌", type: "invited", label: "邀约作品", category: "方牌", images: ["front", "back"], slug: "invited-eagle-square-tag" },
  { id: "upload:2025-invited-gold-c-feather", year: "2024", title: "全金 C 羽", type: "invited", label: "邀约作品", category: "C羽", images: ["front", "back"], slug: "invited-gold-c-feather" },
  { id: "upload:2025-invited-snake-chain", year: "2025", title: "蛇骨链", type: "invited", label: "邀约作品", category: "蛇骨项链", images: ["front"], slug: "invited-snake-chain" },
  { id: "upload:2026-invited-goldtip-chuxin-feather", year: "2026", title: "先金初心羽", type: "invited", label: "邀约作品", category: "初心羽", images: ["front", "back"], slug: "invited-goldtip-chuxin-feather" },
  { id: "upload:2026-display-antique-snake-feather", year: "2026", title: "古董改造蛇羽", type: "display", label: "展示作品", category: "蛇羽", images: ["02-overview", "01-detail"], slug: "display-antique-snake-feather" },
];
const curated = JSON.parse(readFileSync(path.join(root, "data/curated-official.json"), "utf8"));
const source = path.resolve(root, "../album_source");
for (const work of works) {
  const photos = curated.items.filter((item) => item.workId === work.id);
  assert.equal(photos.length, work.images.length, `${work.title}: all supplied photos must enter the matching work record`);
  const entry = JSON.parse(readFileSync(path.join(source, `entries/upload-${work.id.slice(7)}.json`), "utf8"))[0];
  assert.equal(entry.date, null, "year-only work must not acquire an invented date");
  assert.equal(entry.year, work.year);
  assert.equal(entry.title, work.title);
  assert.equal(entry.releaseType, work.type);
  assert.equal(entry.description, "");
  for (const [index, item] of photos.entries()) {
    assert.equal(item.id, `${work.id}:${work.images[index]}`, "cover and carousel must follow the selected photo order");
    assert.equal(item.id, entry.images[index].id, "public carousel order must match canonical image order");
    assert.equal(item.releaseType, work.type);
    assert.equal(item.datePrecision, "year");
    assert.equal(item.year, work.year);
    assert.equal(item.caption, "");
    assert.equal(item.articleId, undefined, "uploaded work must not acquire a fabricated article");
    for (const [publicPath, asset] of [[item.image, entry.images[index]], [item.thumb, entry.images[index].thumbnail]]) {
      const bytes = readFileSync(path.join(root, publicPath));
      assert.ok(bytes.equals(readFileSync(path.join(source, asset.path))), "public images must match canonical assets exactly");
      assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
    }
  }
}
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  const fixture = await browser.newPage();
  await fixture.addInitScript(() => {
    const item = (id, date, datePrecision, sourceIndex) => ({ id, date, datePrecision, sourceIndex, index: sourceIndex, year: "2026", title: id, caption: "", releaseType: "invited" });
    Object.defineProperty(window, "BELONGS_DATA", { value: { items: [item("year-only", "2026", "year", 1), item("late", "2026年12月31日", "day", 2), item("early", "2026年1月1日", "day", 3)] }, writable: false });
    Object.defineProperty(window, "BELONGS_CURATED", { value: { articles: [], items: [] }, writable: false });
  });
  await fixture.goto(`file://${path.join(root, "index.html")}?release=invited`);
  assert.deepEqual(await fixture.locator("#gallery h3").allTextContents(), ["early", "late", "year-only"], "year-only records must not borrow another work's month/day");
  assert.equal((await fixture.locator("#gallery .meta").allTextContents()).at(-1), "2026 年");
  await fixture.close();

  for (const work of works) {
    for (const [width, view] of [[1440, "grid"], [1440, "list"], [390, "grid"], [390, "list"], [320, "grid"], [320, "list"]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`file://${path.join(root, "index.html")}?release=${work.type}&view=${view}`);
      await page.locator("#closeIntro").click();
      assert.equal(await page.locator("#totalCount").textContent(), { personal: "1", invited: "8", display: "4", custom: "4" }[work.type]);
      if (work.type === "invited") {
        const titles = await page.locator("#gallery h3").allTextContents();
        assert.equal(titles[0], "全金B戒", "2022 invitation must precede later works");
        assert.deepEqual(new Set(titles.slice(1, 4)), new Set(["龙·狗牌", "蛇·方牌", "全金 C 羽"]), "2024 invitations must stay together without inventing exact dates");
        assert.deepEqual(new Set(titles.slice(4, 6)), new Set(["鹰·方牌", "蛇骨链"]), "2025 invitations must follow 2024 and precede 2026");
        assert.deepEqual(new Set(titles.slice(6)), new Set(["先金羽翼", "先金初心羽"]), "2026 invitations must follow earlier years without inventing exact dates");
      }
      assert.equal(await page.locator("#gallery .excerpt").count(), 0, "name-only uploaded work must not display a description placeholder");
      assert.deepEqual(await page.locator("#yearFilter option").evaluateAll((nodes) => nodes.map((node) => node.value)), work.type === "invited" ? ["all", "2022", "2024", "2025", "2026"] : ["all", "2026"]);
      await page.locator("#yearFilter").selectOption(work.year);
      await page.locator("#categorySelect").selectOption(work.category);
      await page.locator("#searchInput").fill(work.title);
      assert.equal(await page.locator("#gallery .card").count(), 1);
      assert.equal(await page.locator("#gallery h3").textContent(), work.title);
      if (work.id === "upload:2025-invited-gold-c-feather") {
        assert.equal(await page.locator('#gallery .cover-stamp[aria-label="全金作品"]').count(), 1, "full-gold C feather must show one gold stamp on its carousel cover");
      }
      if (work.id === "upload:2026-display-antique-snake-feather") {
        assert.equal(await page.locator('#gallery .cover-stamp[aria-label="古董改造"]').count(), 1, "antique snake feather must show one antique stamp on its carousel cover");
      }
      assert.equal(await page.locator("#gallery .meta").textContent(), `${work.year} 年`);
      assert.match(await page.locator("#gallery .thumb img").getAttribute("src"), new RegExp(`${work.images[0]}-thumb\\.jpg$`), "card cover must use the selected first photo");
      await page.locator("#gallery .thumb img").scrollIntoViewIfNeeded();
      await page.locator("#gallery .thumb img").evaluate((image) => image.decode());
      assert.equal(await page.locator("#gallery .thumb img").evaluate((image) => {
        const frame = image.closest(".thumb").getBoundingClientRect();
        const box = image.getBoundingClientRect();
        return box.left >= frame.left - 1 && box.right <= frame.right + 1 && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1;
      }), true, "uploaded cover must fit inside its frame without cropping");
      await page.locator("#gallery .card").click();
      assert.deepEqual(await page.evaluate(() => state.activeGroup.items.map((item) => item.workId)), work.images.map(() => work.id), "similarly named display and personal works must keep their own photos");
      assert.equal(await page.locator("#detailTitle").textContent(), work.title);
      assert.equal(await page.locator("#detailMeta").textContent(), `${work.year} 年 · ${work.label}`);
      assert.equal(await page.locator("#detailCaption").textContent(), "");
      assert.equal(await page.locator("#detailCaption").isHidden(), true, "name-only detail must not display a description or placeholder");
      assert.equal(await page.locator("#openArticle").isHidden(), true);
      for (const [index, name] of work.images.entries()) {
        assert.equal(await page.locator("#carouselCount").textContent(), `${index + 1} / ${work.images.length}`);
        await page.waitForFunction(() => document.querySelector("#detailImage").complete && document.querySelector("#detailImage").naturalWidth > 0);
        assert.match(await page.locator("#detailImage").getAttribute("src"), new RegExp(`${name}\\.jpg$`));
        assert.equal(await page.locator("#detailImage").evaluate((node) => getComputedStyle(node).objectFit), "contain");
        if (index < work.images.length - 1) await page.locator("#nextImage").click();
      }
      if (work.images.length > 1) {
        await page.locator("#nextImage").click();
        assert.equal(await page.locator("#carouselCount").textContent(), `1 / ${work.images.length}`, "carousel should wrap after the last photo");
        await page.locator("#prevImage").click();
        assert.equal(await page.locator("#carouselCount").textContent(), `${work.images.length} / ${work.images.length}`);
      } else {
        assert.equal(await page.locator("#carouselControls").isHidden(), true, "single-photo work must not display carousel buttons");
      }
      assert.equal(await page.evaluate(() => {
        const caption = document.querySelector("#detailCaption");
        return document.documentElement.scrollWidth <= innerWidth && [...caption.querySelectorAll("p, dt, dd")].every((node) => node.scrollWidth <= node.clientWidth + 1);
      }), true, "name-only work must fit at desktop and mobile sizes");
      if (process.env.UPLOAD_SCREENSHOT_DIR) {
        mkdirSync(process.env.UPLOAD_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.UPLOAD_SCREENSHOT_DIR, `${work.slug}-${width}-${view}.png`) });
      }
      await page.locator("#closeDialog").click();
      await page.locator("#searchInput").fill("");
      await page.locator('[data-release-type="regular"]').click();
      assert.equal(await page.locator("#totalCount").textContent(), "766");
      assert.equal(await page.evaluate(() => releaseGroups().reduce((count, group) => count + group.imageCount, 0)), 1059);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS ${work.title}: ${work.label}, category, year-only date and ${work.images.length}-photo carousel ${width}px ${view}`);
    }
  }
} finally {
  await browser.close();
}
