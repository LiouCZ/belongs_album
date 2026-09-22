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
    await assertExportUsesReadableTextareaSnapshots(browser);
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

  const exportButton = page.getByRole("button", { name: "导出整页图片" });
  await expectVisible(exportButton);

  await page.evaluate((png) => {
    window.html2canvas = async (target) => {
      window.__exportCheck = {
        actionDisplay: getComputedStyle(document.querySelector(".action-row")).display,
        isExporting: document.body.classList.contains("is-exporting"),
        snapshots: [...target.querySelectorAll(".export-textarea-snapshot")].map((item) => item.textContent),
      };
      return { toDataURL: () => png };
    };
  }, onePixelPng);

  const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
  await download.cancel();

  const check = await page.evaluate(() => window.__exportCheck);
  assert.equal(check.isExporting, true, "body should be in export mode while capturing");
  assert.equal(check.actionDisplay, "none", "operation buttons should be hidden while capturing");
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

async function expectVisible(locator) {
  assert.equal(await locator.count(), 1, "export button should exist exactly once");
  assert.equal(await locator.isVisible(), true, "export button should be visible");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
