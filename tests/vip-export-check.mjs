import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const playwrightRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"))
  : require;
const { chromium } = playwrightRequire("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pageUrl = `file://${path.join(root, "vip.html")}`;
const outputDir = path.join(root, "tmp-test-output");
const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const defaultChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function readPngSize(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", "download should be a PNG file");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function run() {
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || defaultChromePath,
  });
  try {
    await assertDesktopLayoutScalesTo65Percent(browser);
    await assertCustomRulesPageLinkAndContent(browser);
    await assertDesktopExportCapturesWithoutCssZoom(browser);
    await assertExportUsesReadableTextareaSnapshots(browser);
    await assertFailedExportRestoresFields(browser);
    await assertInformationExportIsReadable(browser);
    await assertRealPngDownloads(browser);
  } finally {
    await browser.close();
  }
}

async function assertDesktopLayoutScalesTo65Percent(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(pageUrl);

  const formWidth = await page.locator(".vip-form").evaluate((element) => element.getBoundingClientRect().width);
  assert.ok(
    formWidth >= 680 && formWidth <= 700,
    `desktop form should render at about 65% of the original 1060px width, got ${formWidth}px`,
  );

  await page.close();
}

async function assertDesktopExportCapturesWithoutCssZoom(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
  await page.goto(pageUrl);
  await fillVipForm(page);

  const exportButton = page.getByRole("button", { name: "导出整页图片" });
  await expectVisible(exportButton);

  await page.evaluate((png) => {
    window.html2canvas = async (target) => {
      window.__desktopExportCheck = {
        isExporting: document.body.classList.contains("is-exporting"),
        zoom: getComputedStyle(target).zoom,
        targetWidth: target.getBoundingClientRect().width,
      };
      return { toDataURL: () => png };
    };
  }, onePixelPng);

  const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
  await download.cancel();

  const check = await page.evaluate(() => window.__desktopExportCheck);
  assert.equal(check.isExporting, true, "body should be in export mode while capturing");
  assert.equal(check.zoom, "1", "desktop export should capture the form without CSS zoom to avoid doubled text");
  assert.ok(check.targetWidth >= 1000, `desktop export target should use full readable width, got ${check.targetWidth}`);

  await page.close();
}

async function assertCustomRulesPageLinkAndContent(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(pageUrl);

  const rulesLink = page.getByRole("link", { name: "查看定制规则" });
  await expectVisible(rulesLink);
  await rulesLink.click();
  await page.waitForURL(/custom-rules\.html$/);

  await expectVisible(page.getByRole("heading", { name: "VIP 定制规则", exact: true }));
  await expectVisible(page.getByRole("heading", { name: "积分规则", exact: true }));
  await expectVisible(page.getByRole("heading", { name: "定制规则", exact: true }));
  await expectVisible(page.getByRole("heading", { name: "VIP 定制权益", exact: true }));

  const headers = ["权益项目", "B1", "B2", "B3", "K1", "K2", "K3"];
  for (const header of headers) {
    assert.equal(
      await page.getByRole("columnheader", { name: header, exact: true }).count(),
      1,
      `${header} column should exist`,
    );
  }

  await page.close();
}

async function fillVipForm(page) {
  await page.getByPlaceholder("怎么称呼您").fill("测试用户");
  await page.getByPlaceholder("您的微信昵称").fill("Belongs 测试");
  await page.locator('label:has(input[name="VIP 等级"][value="K2"])').click();
  await page.locator('label:has(input[name="主件类"][value="M十字"])').click();
  await page.locator('label:has(input[name="主题元素"][value="蛇骨"])').click();
  await page.getByPlaceholder(/例如：想做一条蛇骨链吊坠/).fill("希望做一件适合日常佩戴的定制作品。");
}

async function assertExportUsesReadableTextareaSnapshots(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(pageUrl);
  await fillVipForm(page);
  const nickname = "喜欢手工银饰的玩家与日常记录".repeat(4);
  await page.getByPlaceholder("您的微信昵称").fill(nickname);

  const exportButton = page.getByRole("button", { name: "导出整页图片" });
  await expectVisible(exportButton);

  await page.evaluate((png) => {
    window.html2canvas = async (target) => {
      window.__exportCheck = {
        actionDisplay: getComputedStyle(document.querySelector(".action-row")).display,
        isExporting: document.body.classList.contains("is-exporting"),
        snapshots: [...target.querySelectorAll(".export-textarea-snapshot")].map((item) => item.textContent),
        inputSnapshots: [...target.querySelectorAll(".export-input-snapshot")].map((item) => item.textContent),
        fieldsFit: [...target.querySelectorAll(".export-input-snapshot")].every((item) =>
          item.scrollWidth <= item.clientWidth + 1 && item.scrollHeight <= item.clientHeight + 1),
      };
      return { toDataURL: () => png };
    };
  }, onePixelPng);

  const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
  await download.cancel();

  const check = await page.evaluate(() => window.__exportCheck);
  assert.equal(check.isExporting, true, "body should be in export mode while capturing");
  assert.equal(check.actionDisplay, "none", "operation buttons should be hidden while capturing");
  assert.deepEqual(check.inputSnapshots, ["测试用户", nickname, "您的微信号", "方便电话联系"],
    "input snapshots must include full values and preserve the empty-field hints");
  assert.equal(check.fieldsFit, true, "long nicknames must wrap instead of clipping");
  assert.ok(
    check.snapshots.some((text) => text.includes("希望做一件适合日常佩戴的定制作品。")),
    "export should convert filled textareas to readable text snapshots",
  );
  assert.ok(
    check.snapshots.some((text) => text.includes("主件类：M十字") && text.includes("款式描述：希望做")),
    "export should include the generated registration text snapshot",
  );

  await page.close();
}

async function assertFailedExportRestoresFields(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(pageUrl);
  await fillVipForm(page);
  await page.evaluate(() => {
    window.html2canvas = async () => { throw new Error("Simulated rendering failure"); };
  });
  const button = page.getByRole("button", { name: "导出整页图片" });
  await button.click();
  await page.waitForFunction(() => document.querySelector("#copyStatus").textContent === "图片生成失败，请稍后重试");
  assert.equal(await page.getByPlaceholder("怎么称呼您").inputValue(), "测试用户");
  assert.equal(await page.getByPlaceholder("怎么称呼您").isVisible(), true);
  assert.equal(await page.getByPlaceholder(/例如：想做一条蛇骨链吊坠/).inputValue(), "希望做一件适合日常佩戴的定制作品。");
  assert.equal(await page.getByPlaceholder(/例如：想做一条蛇骨链吊坠/).isVisible(), true);
  assert.equal(await page.locator(".export-input-snapshot, .export-textarea-snapshot, .export-field-source").count(), 0);
  assert.equal(await button.isEnabled(), true);
  await page.close();
}

async function assertRealPngDownloads(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(pageUrl);
  await fillVipForm(page);

  const exportButton = page.getByRole("button", { name: "导出整页图片" });
  await expectVisible(exportButton);

  const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
  assert.match(download.suggestedFilename(), /^belongs-vip-registration-\d{8}\.png$/);

  const filePath = path.join(outputDir, download.suggestedFilename());
  await download.saveAs(filePath);
  const buffer = await fs.readFile(filePath);
  assert.ok(buffer.length > 50_000, `exported PNG is too small: ${buffer.length} bytes`);

  const { width, height } = readPngSize(buffer);
  assert.ok(width >= 700, `exported PNG width is too small: ${width}`);
  assert.ok(height >= 2000, `exported PNG height is too small: ${height}`);
  assert.deepEqual(errors, []);

  await page.close();
}

async function assertInformationExportIsReadable(browser) {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
    await page.goto(pageUrl);
    const values = ["Test user", "Belongs", "belongs_player", "13800138000"];
    await page.locator(".field-grid input").evaluateAll((nodes, values) => {
      nodes.forEach((node, index) => { node.value = values[index]; });
    }, values);
    await page.evaluate(() => {
      const render = window.html2canvas;
      window.html2canvas = async (target, options) => {
        const origin = target.getBoundingClientRect();
        const grid = target.querySelector(".field-grid");
        const gap = grid.nextElementSibling.getBoundingClientRect().top - grid.getBoundingClientRect().bottom;
        const fields = [...grid.querySelectorAll("label")].map((label) =>
          (label.querySelector(".export-input-snapshot") || label.querySelector("input")).getBoundingClientRect());
        const canvas = await render(target, options);
        const context = canvas.getContext("2d");
        const scale = canvas.width / origin.width;
        const issues = gap < 20 ? [`VIP group gap is only ${gap}px`] : [];
        for (const [index, field] of fields.entries()) {
          const x = Math.round((field.left - origin.left + 4) * scale);
          const y = Math.round((field.top - origin.top + 2) * scale);
          const w = Math.floor((field.width - 8) * scale);
          const h = Math.floor((field.height - 4) * scale);
          const { data } = context.getImageData(x, y, w, h);
          const background = [10, 24, 38].map((row) => {
            const offset = (Math.floor((row - 2) * scale) * w + Math.floor(w * 0.8)) * 4;
            return [...data.slice(offset, offset + 3)];
          });
          if (background.some((sample) => sample.some((channel, offset) => Math.abs(channel - background[0][offset]) > 3))) {
            issues.push(`field ${index} has shadow bands in the PNG`);
          }
          const rows = [];
          for (let row = 0; row < h; row += 1) {
            for (let column = 0; column < w; column += 1) {
              const offset = (row * w + column) * 4;
              if (data[offset + 3] > 200 && Math.max(data[offset], data[offset + 1], data[offset + 2]) < 150) {
                rows.push(row);
                break;
              }
            }
          }
          if (!rows.length) issues.push(`field ${index} text is missing from the PNG`);
          else {
            const top = rows[0] / scale + 2;
            const bottom = field.height - (rows.at(-1) / scale + 2);
            if (top < 8 || bottom < 8 || Math.abs(top - bottom) > 9) {
              issues.push(`field ${index} text is not centered: ${top}px above, ${bottom}px below`);
            }
          }
        }
        window.__informationExportIssues = issues;
        return canvas;
      };
    });
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出整页图片" }).click()]);
    await download.saveAs(path.join(outputDir, `vip-information-${width}.png`));
    assert.deepEqual(await page.evaluate(() => window.__informationExportIssues), [], `${width}px exported information section`);
    assert.deepEqual(await page.locator(".field-grid input").evaluateAll((nodes) => nodes.map((node) => node.value)), values,
      "export must not alter personal information");
    assert.equal(await page.locator(".field-grid input").first().isVisible(), true, "inputs must be restored after export");
    assert.equal(await page.locator(".export-input-snapshot, .export-textarea-snapshot").count(), 0, "temporary snapshots must be removed");
    console.log(`PASS VIP information PNG text alignment and group spacing ${width}px`);
    await page.close();
  }
}

async function expectVisible(locator) {
  assert.equal(await locator.count(), 1, "export button should exist exactly once");
  assert.equal(await locator.isVisible(), true, "export button should be visible");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
