import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const playwrightRequire = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, "package.json"))
  : require;
const { chromium } = playwrightRequire("playwright");
const localePath = path.join(root, "locales/en/vip.js");
assert.equal(await fs.stat(localePath).then(() => true, () => false), true,
  "VIP English dictionary must exist before the bilingual form can render");

const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

// Supply only the shared contract so this subtask can run before the shell lands.
async function openPage(file, width = 390) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
  const html = await fs.readFile(path.join(root, file), "utf8");
  await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""));
  await page.addScriptTag({ path: localePath });
  await page.evaluate(() => {
    let language = "zh";
    window.BelongsI18n = {
      english: () => language === "en",
      t(source, vars = {}) {
        const key = source.replace(/\s+/g, " ").trim();
        const text = language === "en" ? window.BELONGS_EN.text[key] ?? source : source;
        return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
      },
      setLanguage(next) {
        language = next;
        window.dispatchEvent(new CustomEvent("belongs:language-change", { detail: { language } }));
      },
    };
  });
  if (file === "vip.html") await page.addScriptTag({ path: path.join(root, "vip.js") });
  return page;
}

async function staticCoverage() {
  for (const file of ["vip.html", "custom-rules.html"]) {
    const page = await openPage(file);
    const missing = await page.evaluate(() => {
      const normalize = (text) => text.replace(/\s+/g, " ").trim();
      const sources = [];
      const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentElement.closest("script, style, select")) sources.push(node.textContent);
      }
      for (const node of document.querySelectorAll("[placeholder], [title], [aria-label], [alt]")) {
        for (const attribute of ["placeholder", "title", "aria-label", "alt"]) {
          if (node.hasAttribute(attribute)) sources.push(node.getAttribute(attribute));
        }
      }
      return [...new Set(sources.map(normalize).filter((text) => /[\u3400-\u9fff]/u.test(text)))].filter(
        (text) => !window.BELONGS_EN.text[text] || /[\u3400-\u9fff]/u.test(window.BELONGS_EN.text[text]),
      );
    });
    assert.deepEqual(missing, [], `${file}: all Chinese leaves, placeholders, titles and accessible labels need English`);
    if (file === "custom-rules.html") {
      const policies = await page.evaluate(() => {
        window.BelongsI18n.setLanguage("en");
        const t = window.BelongsI18n.t;
        const leaves = (element) => [...element.childNodes].map((node) =>
          node.nodeType === Node.TEXT_NODE ? t(node.textContent) : node.textContent).join("").replace(/\s+/g, " ").trim();
        return {
          cleaning: t(document.querySelector(".rule-block p").textContent),
          earning: t(document.querySelectorAll(".rule-block p")[1].textContent),
          deposit: leaves(document.querySelectorAll(".rule-list li")[4]),
          cap: leaves(document.querySelector(".benefits-table tbody tr:last-child td:last-child strong")),
        };
      });
      assert.match(policies.cleaning, /15,000 points per (?:piece|item)/);
      assert.match(policies.earning, /CNY 1 = 1 point/);
      assert.match(policies.earning, /September 1, 2023/);
      assert.match(policies.deposit, /60%.*deposit|deposit.*60%/);
      assert.match(policies.cap, /8 (?:pieces|items) (?:in total|total)/);
    }
    await page.close();
    console.log(`PASS VIP English leaf and attribute coverage: ${file}`);
  }
}

async function formStateAndStatuses() {
  const page = await openPage("vip.html");
  await page.locator('[name="称呼"]').fill("羽翼");
  await page.locator('[name="微信昵称"]').fill("其他");
  await page.locator('[name="微信号"]').fill("belongs_player");
  await page.locator('[name="款式描述"]').fill("蛇骨");
  await page.locator('[name="其他备注"]').fill("暂不确定");
  for (const [name, value] of [["VIP 等级", "暂不确定"], ["预算区间", "1-3 万"],
    ["主件类", "M十字"], ["主件类", "钥匙"], ["主题元素", "蛇骨"], ["主题元素", "羽翼"]]) {
    await page.locator(`input[name="${name}"][value="${value}"]`).check();
  }
  const original = await page.locator("#resultText").inputValue();
  assert.match(original, /称呼：羽翼/);
  assert.match(original, /主件类：M十字、钥匙/);
  const values = await page.locator("#vipForm input, #vipForm textarea[name]").evaluateAll((nodes) =>
    nodes.map(({ name, value, checked }) => ({ name, value, checked })));

  await page.evaluate(() => window.BelongsI18n.setLanguage("en"));
  const summary = await page.locator("#resultText").inputValue();
  assert.match(summary, /VIP Custom Inquiry/);
  assert.match(summary, /Name: 羽翼/);
  assert.match(summary, /WeChat nickname: 其他/);
  assert.match(summary, /Phone number: Not provided/);
  assert.match(summary, /VIP level: Not sure yet/);
  assert.match(summary, /Budget range: CNY 10,000-30,000/);
  assert.match(summary, /Main pieces: M Cross, Key/);
  assert.match(summary, /Theme elements: Serpent Bone, Wings/);
  assert.match(summary, /Design description: 蛇骨/);
  assert.match(summary, /Additional notes: 暂不确定/);
  assert.deepEqual(await page.locator("#vipForm input, #vipForm textarea[name]").evaluateAll((nodes) =>
    nodes.map(({ name, value, checked }) => ({ name, value, checked }))), values,
  "switching language must preserve personal text, canonical input names, values and choices");

  await page.locator('input[name="主件类"][value="马首"]').click();
  assert.equal(await page.locator('input[name="主件类"]:checked').count(), 2);
  assert.match(await page.locator("#copyStatus").textContent(), /(?:up to|maximum of) 2.*Main pieces/i);
  await page.evaluate(() => window.BelongsI18n.setLanguage("zh"));
  assert.match(await page.locator("#copyStatus").textContent(), /最多选择 2 项/);
  assert.equal(await page.locator("#resultText").inputValue(), original);
  await page.evaluate(() => window.BelongsI18n.setLanguage("en"));
  await page.locator('input[name="主题元素"][value="葡萄叶"]').check();
  await page.locator('input[name="主题元素"][value="麦穗"]').click();
  assert.equal(await page.locator('input[name="主题元素"]:checked').count(), 3);
  assert.match(await page.locator("#copyStatus").textContent(), /(?:up to|maximum of) 3.*Theme elements/i);

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { window.copiedRegistration = text; },
    } });
  });
  await page.locator("#copyButton").click();
  assert.equal(await page.evaluate(() => window.copiedRegistration), await page.locator("#resultText").inputValue());
  assert.equal(await page.locator("#copyStatus").textContent(), "Registration copied");
  await page.evaluate(() => window.BelongsI18n.setLanguage("zh"));
  assert.equal(await page.locator("#copyStatus").textContent(), "已复制登记内容");
  await page.evaluate(() => window.BelongsI18n.setLanguage("en"));
  await page.locator("#exportButton").click();
  assert.equal(await page.locator("#copyStatus").textContent(), "The image exporter could not load. Refresh the page and try again.");
  await page.evaluate(() => window.BelongsI18n.setLanguage("zh"));
  assert.equal(await page.locator("#copyStatus").textContent(), "导出组件加载失败，请刷新页面后重试");

  await page.locator('button[type="reset"]').click();
  await page.waitForFunction(() => document.querySelector("#copyStatus").textContent === "");
  await page.evaluate(() => window.BelongsI18n.setLanguage("en"));
  assert.equal(await page.locator("#copyStatus").textContent(), "");
  assert.equal(await page.locator("input:checked").count(), 0);
  assert.match(await page.locator("#resultText").inputValue(), /Name: Not provided/);
  await page.close();
  console.log("PASS VIP bilingual summaries, untouched free text, checkbox limits, retained status and reset");
}

async function englishExport() {
  const page = await openPage("vip.html");
  await page.addStyleTag({ path: path.join(root, "vip.css") });
  await page.addScriptTag({ path: path.join(root, "vendor/html2canvas.min.js") });
  await page.evaluate(() => {
    window.BelongsI18n.setLanguage("en");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement.closest("script, style, select")) {
        walker.currentNode.textContent = window.BelongsI18n.t(walker.currentNode.textContent);
      }
    }
    for (const node of document.querySelectorAll("[placeholder]")) {
      node.placeholder = window.BelongsI18n.t(node.placeholder);
    }
    const render = window.html2canvas;
    window.html2canvas = async (target, options) => {
      window.exportedInputText = [...target.querySelectorAll(".export-input-snapshot")].map((node) => node.textContent);
      window.exportedSummary = target.querySelector(".output-card .export-textarea-snapshot").textContent;
      return render(target, options);
    };
  });
  await page.locator('[name="称呼"]').fill("羽翼");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportButton").click();
  const download = await downloadPromise;
  const output = path.join(root, "tmp-test-output/vip-i18n-en.png");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await download.saveAs(output);
  const png = await fs.readFile(output);
  assert.ok(png.length > 50_000, "English export must contain a rendered form, not a blank image");
  assert.ok(png.readUInt32BE(16) >= 700);
  assert.ok(png.readUInt32BE(20) >= 2000);
  assert.equal(await page.locator("#copyStatus").textContent(), "Image generated; download started");
  assert.match(await page.evaluate(() => window.exportedSummary), /Name: 羽翼/);
  assert.deepEqual(await page.evaluate(() => window.exportedInputText),
    ["羽翼", "Your WeChat nickname", "Your WeChat ID", "For phone contact"]);
  assert.equal(await page.locator(".export-field-source, .export-input-snapshot, .export-textarea-snapshot").count(), 0);
  assert.equal(await page.locator('[name="称呼"]').inputValue(), "羽翼");
  await page.evaluate(() => window.BelongsI18n.setLanguage("zh"));
  assert.equal(await page.locator("#copyStatus").textContent(), "图片已生成并开始下载");
  await page.close();
  console.log(`PASS VIP real English PNG export: ${output}`);
}

try {
  await staticCoverage();
  await formStateAndStatuses();
  await englishExport();
} finally {
  await browser.close();
}
