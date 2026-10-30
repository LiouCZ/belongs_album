import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(path.join(root, "album-categories.js"), "utf8"), context);
const categories = (title, caption = "") => Array.from(context.window.BELONGS_CATEGORIES.forGroup({ title, caption }));

for (const title of ["2.s十字", "十字架S", "十字架（S）", "Ｓ 十字套装"]) {
  assert.deepEqual(categories(title), ["S十字"]);
}
assert.deepEqual(categories("M十字", "搭配：L十字、S十字、蛇骨链"), ["M十字"]);
assert.deepEqual(categories("初心羽（搭配：S十字、银链）"), ["初心羽"]);
assert.deepEqual(categories("2.初心羽（雕刻，搭配M十字、银链）"), ["初心羽"]);
assert.deepEqual(categories("镂空M十字"), ["M镂空十字"]);
assert.deepEqual(categories("L十字架"), ["L十字"]);
assert.deepEqual(categories("Mini十字狗牌"), ["Mini十字狗牌"]);
assert.deepEqual(categories("⓫角链"), ["角链"]);
assert.deepEqual(categories("初心羽毛套装"), ["初心羽"]);
assert.deepEqual(categories("初心羽戒指"), ["初心羽戒指"]);
assert.deepEqual(categories("羽翼戒指", "羽翼造型手镯"), ["羽翼戒指"]);
assert.deepEqual(categories("蛇骨链"), ["蛇骨项链"]);
assert.deepEqual(categories("马头吊坠"), ["马首"]);
assert.deepEqual(categories("发售", "●主件\n1.S十字\n自由的羽毛\n*搭配：M十字、角链\n2.L十字\n●配件\n③贝贝羽"), ["S十字", "L十字", "贝贝羽"]);
assert.deepEqual(categories("发售中", "搭配：M十字、蛇骨链\n*材质：S925 Au750"), ["其他图文"]);
assert.deepEqual(categories("侘寂之美", "我们追求手工留下的温度。"), ["其他图文"]);
assert.deepEqual(categories("银饼、初心羽、平打手镯"), ["银饼", "初心羽", "平打手镯"]);
console.log("PASS category names, aliases, numbered descriptions and accessory exclusions");

const require = createRequire(import.meta.url);
const playwrightRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json")) : require;
const { chromium } = playwrightRequire("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const [width, view] of [[1440, "grid"], [320, "grid"], [1440, "list"], [390, "list"], [320, "list"]]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`file://${path.join(root, "index.html")}${view === "list" ? "?view=list" : ""}`);
    await page.locator("#closeIntro").click();
    const select = page.getByRole("combobox", { name: "品类筛选" });
    assert.equal(await select.isVisible(), true);
    assert.equal(await select.inputValue(), "all");
    for (const category of ["S十字", "M十字", "L十字", "M镂空十字"]) {
      assert.equal(await select.locator(`option[value="${category}"]`).count(), 1);
    }
    if (await page.evaluate(() => CSS.supports("appearance", "base-select"))) {
      await select.click();
      await select.locator('option[value="鹰首"]').click();
      assert.equal(await select.inputValue(), "鹰首");
      assert.equal(await select.evaluate((node) => node.matches(":open")), false);
      assert.match(await select.locator("selectedcontent").textContent(), /鹰首/);
      await select.focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("Home");
      await page.keyboard.press("Enter");
      assert.equal(await select.inputValue(), "all");
      await select.click();
      await page.keyboard.press("Escape");
      assert.equal(await select.evaluate((node) => node.matches(":open")), false);
      await page.locator("#pageSizeSelect").click();
      await page.locator('#pageSizeSelect option[value="25"]').click();
      assert.equal(await page.locator("#gallery .card").count(), 25);
      await page.locator("#pageSizeSelect").selectOption("20");
    }
    const total = await page.locator("#totalCount").textContent();
    await page.locator("#nextPage").click();
    await select.selectOption("S十字");
    assert.match(await page.locator("#pageInfo").textContent(), /第 1 \/ /);
    assert.equal(await page.evaluate(() => state.filtered.every((group) => group.categories.includes("S十字"))), true);
    assert.ok(Number(await page.locator("#visibleCount").textContent()) > 20);
    const firstId = await page.locator("#gallery .card").first().getAttribute("data-id");
    await page.locator("#nextPage").click();
    assert.notEqual(await page.locator("#gallery .card").first().getAttribute("data-id"), firstId);
    await page.getByRole("combobox", { name: "年份筛选" }).selectOption("2026");
    if (await page.evaluate(() => CSS.supports("appearance", "base-select"))) {
      const count = await page.locator("#visibleCount").textContent();
      assert.ok((await select.locator("selectedcontent").textContent()).includes(`${count} 组`));
    }
    assert.match(await page.locator("#pageInfo").textContent(), /第 1 \/ /);
    assert.equal(await page.evaluate(() => state.filtered.every((group) => group.years.includes("2026") && group.categories.includes("S十字"))), true);
    assert.equal(await page.locator("#totalCount").textContent(), total);
    await page.locator("#searchInput").fill("2026年7月10日");
    assert.equal(await page.locator("#visibleCount").textContent(), "1");
    assert.equal(await page.locator("#gallery h3").textContent(), "S十字");
    assert.match(await page.locator("#summaryText").textContent(), /S十字/);
    await page.locator('#viewSwitch [data-view="' + (view === "list" ? "grid" : "list") + '"]').click();
    assert.equal(await select.inputValue(), "S十字");
    assert.equal(await page.locator("#gallery .card").count(), 1);
    await page.locator("#searchInput").fill("no-matching-category-entry");
    assert.equal(await select.isVisible(), true);
    assert.equal(await select.inputValue(), "S十字");
    assert.equal(await page.locator("#pagination").isHidden(), true);
    assert.equal(await page.locator("#emptyState").isVisible(), true);
    await page.locator("#searchInput").fill("");
    await select.selectOption("all");
    await page.getByRole("combobox", { name: "年份筛选" }).selectOption("all");
    assert.equal(await page.locator("#visibleCount").textContent(), total);
    assert.equal(await page.evaluate(() => {
      const controls = [...document.querySelectorAll(".controls input, .controls select")].map((node) => node.getBoundingClientRect());
      return document.documentElement.scrollWidth <= innerWidth && controls.every((box) => box.left >= 0 && box.right <= innerWidth);
    }), true);
    assert.deepEqual(errors, []);
    console.log(`PASS category filtering ${width}px ${view}`);
    await page.close();
  }
  const player = await browser.newPage();
  await player.goto(`file://${path.join(root, "player.html")}`);
  assert.equal(await player.locator("#categorySelect").count(), 0);
  assert.equal(await player.locator("#visibleCount").textContent(), "30");
  await player.close();
} finally {
  await browser.close();
}
