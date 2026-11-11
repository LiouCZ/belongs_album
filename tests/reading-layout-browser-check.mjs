import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const runtime = process.env.PLAYWRIGHT_MODULE_DIR ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json")) : require;
const { chromium } = runtime("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const width of [1440, 1024, 861, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`file://${path.join(root, "index.html")}`);
    assert.doesNotMatch(await page.locator("#summaryText").textContent(), /加载失败/, "initial card rendering must also accept ungrouped source items");
    assert.equal(await page.locator("#gallery .card").count(), 20);
    await page.locator("#closeIntro").click();
    await page.evaluate(() => openDetail(state.groups.find((group) => group.title === "行万里路")));
    assert.equal(await page.locator("#detailCaption .reading-item").count(), 6);
    assert.ok(await page.locator("#detailCaption .reading-paragraph").count() >= 5);
    if (width === 1440) assert.ok((await page.locator("#detailCaption").boundingBox()).width >= 450, "long prose needs a wider reading column");
    const audit = await page.evaluate(() => {
      const failures = [];
      for (const group of state.groups) {
        const copy = workCopy(group);
        els.detailTitle.innerHTML = window.BelongsReading.headingHtml(copy.title);
        renderDetailCaption(group);
        const fallback = group.items[0].workId?.startsWith("upload:") ? "" : "无文字说明";
        if (els.detailCaption.textContent !== (copy.caption || fallback)) failures.push(`${group.id}: text changed`);
        const type = els.detailCaption.querySelector('dt[data-label="制作类型："]');
        if (type) {
          const labels = [...type.closest("dl").querySelectorAll("dt")].map((node) => (node.dataset.label || node.textContent).replace(/^[ \t]*[*＊]?[ \t]*/, "").trim());
          if (["制作类型：", "元素：", "搭配：", "规格：", "材质："].some((label) => !labels.includes(label))) failures.push(`${group.id}: fragmented specifications`);
        }
        for (const label of els.detailCaption.querySelectorAll("dt[data-label]")) {
          if (getComputedStyle(label, "::before").content !== JSON.stringify(label.dataset.label)) failures.push(`${group.id}: invisible field label`);
        }
        if (els.detailTitle.textContent + (copy.caption.startsWith("（") || copy.caption.startsWith("(") ? copy.caption.split("\n\n")[0] : "") !== group.title
          && copy.title !== group.title) failures.push(`${group.id}: title split changed text`);
        const container = els.detailCaption.getBoundingClientRect();
        const overflowing = [...els.detailCaption.querySelectorAll("p, dt, dd, h4, .reading-item")].some((element) => {
          const box = element.getBoundingClientRect();
          return element.scrollWidth > element.clientWidth + 1 || box.left < container.left - 1 || box.right > container.right + 1;
        });
        if (overflowing) failures.push(`${group.id}: text overflow`);
      }
      return { count: state.groups.length, failures };
    });
    assert.equal(audit.count, 767);
    assert.deepEqual(audit.failures, [], `${width}px corpus audit`);
    await page.locator("#closeDialog").click();
    for (const id of ["2023-043-7327f96269", "2023-035-d5db39d114", "2023-013-361b50f596", "2021-225-3d46972a33", "2022-068-bedc317626", "2026-002-814025bed3"]) {
      await page.evaluate((id) => openDetail(state.groups.find((group) => group.items.some((item) => item.id === id))), id);
      await page.waitForFunction(() => els.detailImage.complete && els.detailImage.naturalWidth > 0);
      assert.equal(await page.locator("#detailImage").evaluate((node) => getComputedStyle(node).objectFit), "contain");
      if (process.env.READING_SCREENSHOTS && [1440, 390].includes(width)) {
        await page.screenshot({ path: `/tmp/belongs-reading-${id}-${width}.png` });
      }
      await page.locator("#closeDialog").click();
    }
    for (const view of ["grid", "list"]) {
      await page.locator(`#viewSwitch [data-view="${view}"]`).click();
      await page.locator("#searchInput").fill("梦想与现实");
      assert.equal(await page.locator("#gallery .card").count(), 1);
      assert.equal(await page.locator("#gallery .card h3").textContent(), "2.狗牌");
      assert.match(await page.locator("#gallery .card .excerpt").textContent(), /梦想与现实/);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS all ${audit.count} reading layouts preserve text and fit ${width}px; special works, grid/list and original images`);
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(`file://${path.join(root, "brand-story.html")}`);
  const count = await page.evaluate(() => {
    for (const story of window.BELONGS_STORIES) {
      openSource(story);
      const copies = [...document.querySelectorAll(".story-source-section .reading-copy")];
      if (copies.length !== story.sourceSections.length || copies.some((copy, index) => copy.textContent !== story.sourceSections[index].text)) {
        throw new Error(`${story.id}: changed story source text`);
      }
      document.querySelector("#storySourceDialog").close();
    }
    return window.BELONGS_STORIES.length;
  });
  assert.equal(count, 93);
  await page.close();
  console.log("PASS all 93 brand-story original excerpts use the same lossless reading layout");
} finally {
  await browser.close();
}
