import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json")) : createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const page = await browser.newPage();
  for (const [filename, title] of [
    ["index.html", "BELONGS B&K | 官方画册"],
    ["index.html?view=list", "BELONGS B&K | 官方画册"],
    ["player.html", "BELONGS B&K | 玩家分享"],
    ["brand-story.html", "BELONGS B&K | 品牌故事"],
    ["vip.html", "BELONGS B&K | VIP 定制意向登记"],
    ["custom-rules.html", "BELONGS B&K | VIP 定制规则"],
  ]) {
    await page.goto(`file://${path.join(root, filename)}`);
    assert.equal(await page.title(), title, "browser titles consistently identify both the brand and the current page");
    console.log(`PASS page title ${filename}`);
  }
} finally {
  await browser.close();
}
