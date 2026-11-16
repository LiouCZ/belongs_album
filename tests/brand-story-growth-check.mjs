import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR || root, "package.json"));
const { chromium } = require("playwright");
const screenshotDir = process.env.ORNAMENT_SCREENSHOT_DIR;

async function openPage(browser, options = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 300 }, ...options });
  page.setDefaultTimeout(8000);
  await page.addInitScript(() => {
    window.ornamentPaints = 0;
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.closest(".story-ornament")) window.ornamentPaints += 1;
      return clearRect.apply(this, args);
    };
  });
  await page.route("https://belongs.test/**", async (route) => {
    const resource = path.resolve(root, `.${new URL(route.request().url()).pathname}`);
    if (!resource.startsWith(`${root}${path.sep}`) || !existsSync(resource)) {
      return route.fulfill({ status: 404, body: "Not found" });
    }
    await route.fulfill({ path: resource });
  });
  return page;
}

async function ink(host) {
  return host.locator("canvas").evaluate((canvas) => {
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    let alpha = 0;
    for (let offset = 3; offset < pixels.length; offset += 4) {
      if (pixels[offset] > 10) count += 1;
      alpha += pixels[offset];
    }
    return { count, alpha };
  });
}

async function screenshot(page, name) {
  if (!screenshotDir) return;
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
}

async function assertClearAreas(page) {
  assert.equal(await page.locator(".story-ornament canvas").evaluateAll((canvases) => {
    const boxes = [...document.querySelectorAll(".story-sketch, .philosophy-introduction, .brand-illustration")]
      .map((element) => element.getBoundingClientRect());
    return canvases.every((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      const scale = canvas.width / bounds.width;
      const context = canvas.getContext("2d");
      return boxes.every((box) => {
        const left = Math.max(0, Math.floor((box.left - bounds.left - 8) * scale));
        const top = Math.max(0, Math.floor((box.top - bounds.top - 8) * scale));
        const right = Math.min(canvas.width, Math.ceil((box.right - bounds.left + 8) * scale));
        const bottom = Math.min(canvas.height, Math.ceil((box.bottom - bounds.top + 8) * scale));
        if (right <= left || bottom <= top) return true;
        const pixels = context.getImageData(left, top, right - left, bottom - top).data;
        for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] > 10) return false;
        return true;
      });
    });
  }), true, "growing decorations must preserve clear space around text and images, including after scrolling");
  assert.equal(await page.locator(".story-ornament canvas").evaluateAll((canvases) => canvases.every((canvas) => {
    const context = canvas.getContext("2d");
    const strips = [
      [0, 0, canvas.width, 3],
      [0, canvas.height - 3, canvas.width, 3],
      [0, 0, 3, canvas.height],
      [canvas.width - 3, 0, 3, canvas.height],
    ];
    return strips.every((strip) => {
      const pixels = context.getImageData(...strip).data;
      for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] > 10) return false;
      return true;
    });
  })), true, "unfolding leaves and extending bones must not be clipped at any sampled growth stage");
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
try {
  for (const width of [320, 390, 1440]) {
    const mobile = width < 1024;
    const page = await openPage(browser, {
      viewport: { width, height: 300 },
      hasTouch: mobile,
      isMobile: mobile,
      deviceScaleFactor: mobile ? 2 : 1,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("https://belongs.test/brand-story.html");
    await page.waitForFunction(() => [...document.querySelectorAll(".story-ornament")]
      .every((host) => host.dataset.ornamentState === "ready"));
    const bone = page.locator(".story-ornament--bone");
    const vine = page.locator(".story-ornament--vine");
    assert.equal(await bone.getAttribute("data-growth-state"), "waiting", "offscreen bones must wait for the reader");
    assert.equal(await vine.getAttribute("data-growth-state"), "waiting", "offscreen vines must wait for the reader");
    assert.deepEqual(await ink(bone), { count: 0, alpha: 0 }, "the full decoration must not already be drawn at the start");
    await page.waitForTimeout(400);
    assert.equal(await bone.getAttribute("data-growth-state"), "waiting");

    await bone.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".story-ornament--bone").dataset.growthState === "growing");
    await page.waitForTimeout(800);
    const partialBone = await ink(bone);
    assert.ok(partialBone.count > 40, "some complete bone units should have appeared during growth");
    await assertClearAreas(page);
    await screenshot(page, `${width}-bones-growing`);
    await page.setViewportSize({ width: mobile ? (width === 320 ? 568 : 844) : 1280, height: 300 });
    await bone.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    assert.equal(await bone.getAttribute("data-growth-state"), "growing", "resizing during growth must not reset the animation");
    assert.ok((await ink(bone)).count > 0, "resizing must redraw the current partial path, not flash blank");
    await assertClearAreas(page);
    // Shrinking at the landscape scroll offset can briefly expose the later vine.
    await page.evaluate(() => scrollTo(0, 0));
    await page.setViewportSize({ width, height: 300 });
    await page.waitForTimeout(100);
    const pausedBone = await ink(bone);
    await page.waitForTimeout(400);
    assert.deepEqual(await ink(bone), pausedBone, "offscreen growth must pause instead of consuming the effect");
    await bone.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    assert.equal(await bone.getAttribute("data-growth-state"), "growing", "returning resumes the unfinished drawing");
    await assertClearAreas(page);
    for (let frame = 0; frame < 3; frame += 1) {
      await page.waitForTimeout(1500);
      await assertClearAreas(page);
    }
    assert.equal(await bone.getAttribute("data-growth-state"), "complete", "bones should finish in about five seconds of visible time");
    assert.ok((await ink(bone)).count > partialBone.count * 2, "the bone path must lengthen, not just fade in as a whole");

    if (width < 1024) {
      assert.equal(await vine.getAttribute("data-growth-state"), "waiting", "the later mobile vine has its own visibility trigger");
      await vine.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector(".story-ornament--vine").dataset.growthState === "growing");
      await page.waitForTimeout(900);
      const partialVine = await ink(vine);
      assert.ok(partialVine.count > 30, "the vine should extend before all leaves have opened");
      await assertClearAreas(page);
      await screenshot(page, `${width}-vine-growing`);
      for (let frame = 0; frame < 4; frame += 1) {
        await page.waitForTimeout(1100);
        await assertClearAreas(page);
      }
      assert.equal(await vine.getAttribute("data-growth-state"), "complete");
      assert.ok((await ink(vine)).count > partialVine.count * 1.5, "stems, tendrils and leaves must grow progressively");
    } else {
      await vine.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector(".story-ornament--vine").dataset.growthState === "complete");
    }
    const finalVine = await ink(vine);
    const finalPaints = await page.evaluate(() => window.ornamentPaints);
    await page.waitForTimeout(250);
    assert.deepEqual(await ink(vine), finalVine, "completed ornaments should stop moving");
    assert.equal(await page.evaluate(() => window.ornamentPaints), finalPaints, "completed growth must stop repainting idle canvases");
    await page.evaluate(() => scrollTo(0, 0));
    await vine.scrollIntoViewIfNeeded();
    await page.setViewportSize({ width: mobile ? (width === 320 ? 390 : 320) : 1280, height: 700 });
    await page.waitForTimeout(150);
    assert.equal(await bone.getAttribute("data-growth-state"), "complete", "resize must not replay completed growth");
    assert.equal(await vine.getAttribute("data-growth-state"), "complete");
    assert.ok((await ink(vine)).count > 100, "resizing should redraw the completed vine at the new size");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await assertClearAreas(page);
    await screenshot(page, `${width}-complete-resized`);
    if (mobile) {
      const greeting = page.getByRole("button", { name: "与 Lydia 打招呼" });
      await greeting.tap();
      assert.equal(await page.locator("#brandVoiceFemale").isVisible(), true,
        "ornament canvases must not intercept mobile portrait taps");
      await greeting.tap();
      assert.equal(await page.locator("#brandVoiceFemale").isHidden(), true);
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS visible progressive growth, pause, completion, resize and no replay ${width}px`);
  }

  const reduced = await openPage(browser, { reducedMotion: "reduce" });
  await reduced.goto("https://belongs.test/brand-story.html");
  await reduced.waitForFunction(() => [...document.querySelectorAll(".story-ornament")]
    .every((host) => host.dataset.growthState === "complete"));
  for (const host of await reduced.locator(".story-ornament").all()) assert.ok((await ink(host)).count > 100);
  await reduced.close();

  const preference = await openPage(browser);
  await preference.goto("https://belongs.test/brand-story.html");
  await preference.waitForFunction(() => document.querySelector(".story-ornament").dataset.ornamentState === "ready");
  await preference.locator(".story-ornament--bone").scrollIntoViewIfNeeded();
  await preference.waitForFunction(() => document.querySelector(".story-ornament--bone").dataset.growthState === "growing");
  await preference.emulateMedia({ reducedMotion: "reduce" });
  await preference.waitForFunction(() => [...document.querySelectorAll(".story-ornament")]
    .every((host) => host.dataset.growthState === "complete"));
  await preference.emulateMedia({ reducedMotion: "no-preference" });
  await preference.locator(".story-ornament--vine").scrollIntoViewIfNeeded();
  assert.equal(await preference.locator(".story-ornament--vine").getAttribute("data-growth-state"), "complete");
  await preference.close();

  const fallback = await openPage(browser);
  await fallback.addInitScript(() => { delete window.IntersectionObserver; });
  await fallback.goto("https://belongs.test/brand-story.html");
  await fallback.waitForFunction(() => [...document.querySelectorAll(".story-ornament")]
    .every((host) => host.dataset.growthState === "complete"));
  await fallback.close();
  console.log("PASS reduced motion, live preference changes and static observation fallback");
} finally {
  await browser.close();
}
