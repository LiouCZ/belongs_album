import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR || root, "package.json"));
const { chromium } = require("playwright");
const assets = ["grape-leaf-cutout.png", "snake-bone-cutout.png"];

for (const name of assets) {
  assert.ok(existsSync(path.join(root, "assets/brand-story", name)), `missing photo-derived ornament: ${name}`);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  const page = await browser.newPage();
  for (const name of assets) {
    const pixels = await page.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      let transparent = 0;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;
      let opaque = 0;
      let green = 0;
      const luminance = [];
      const colors = new Set();
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const offset = (y * canvas.width + x) * 4;
          const alpha = rgba[offset + 3];
          if (alpha > 200) {
            opaque += 1;
            const [red, g, blue] = rgba.slice(offset, offset + 3);
            if (g > red + 8 && g > blue + 10) green += 1;
            luminance.push((red + g + blue) / 3);
          }
          if (alpha < 5) transparent += 1;
          if (alpha > 30) {
            ink += 1;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            colors.add(`${rgba[offset]},${rgba[offset + 1]},${rgba[offset + 2]}`);
          }
        }
      }
      luminance.sort((a, b) => a - b);
      const contrast = luminance[Math.floor(luminance.length * 0.95)] - luminance[Math.floor(luminance.length * 0.05)];
      return { ink, transparent, colors: colors.size, width: canvas.width, height: canvas.height, minX, minY, maxX, maxY, opaque, green, contrast };
    }, readFileSync(path.join(root, "assets/brand-story", name)).toString("base64"));
    assert.ok(pixels.ink > 1000, `${name} must contain visible extracted detail`);
    assert.ok(pixels.transparent > pixels.width * pixels.height * 0.25, `${name} needs genuine transparent whitespace`);
    assert.ok(pixels.colors > 300, `${name} should retain the photograph's metallic texture, not a flat substitute`);
    if (name === "grape-leaf-cutout.png") {
      assert.ok(pixels.green > pixels.opaque * 0.9, "grape leaves should have a natural green color, not the original gold tint");
      assert.ok(pixels.contrast > 90, "leaf highlights and recessed veins should remain distinct");
    }
    if (name === "snake-bone-cutout.png") {
      assert.ok(pixels.minX >= 10 && pixels.minY >= 10 && pixels.maxX < pixels.width - 10 && pixels.maxY < pixels.height - 10, "all bone hooks need transparent padding; never end a rib at the crop boundary");
    }
  }
  await page.close();
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await page.goto(`file://${path.join(root, "brand-story.html")}`);
    assert.equal(await page.locator(".story-ornament canvas").count(), 2, "draw proportion-preserving organic paths at the actual viewport width");
    await page.waitForFunction(() => [...document.querySelectorAll(".story-ornament")].every((element) => element.dataset.ornamentState === "ready"));
    const boxes = await page.locator(".story-ornament").evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { x: box.x, right: box.right, width: box.width, height: box.height, pointerEvents: style.pointerEvents };
    }));
    assert.equal(boxes.length, 2);
    const vineStyle = await page.locator(".story-ornament--vine").evaluate((element) => {
      const style = getComputedStyle(element);
      return { opacity: Number(style.opacity), filter: style.filter };
    });
    assert.ok(vineStyle.opacity >= 0.75, "green leaf texture must not be washed out by the old opacity");
    assert.equal(vineStyle.filter, "none", "do not desaturate the requested green leaf color");
    for (const box of boxes) {
      assert.equal(box.pointerEvents, "none");
      assert.ok(box.x >= 0 && box.right <= width, "organic ornaments must stay inside the screen");
    }
    if (width >= 1024) {
      assert.ok(boxes[0].height > 600 && boxes[1].height > 800, "the motifs should extend around the opening images");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.close();
  }
  const rendered = await browser.newPage({ reducedMotion: "reduce", deviceScaleFactor: 2 });
  await rendered.addInitScript(() => {
    window.boneDraws = [];
    window.boneRemovedPixels = 0;
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
      if (this.canvas.closest(".story-ornament--bone")) {
        const [x, y, width, height] = args.length === 8 ? args.slice(4) : args;
        const matrix = this.getTransform();
        const corners = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(([px, py]) => new DOMPoint(px, py).matrixTransform(matrix));
        window.boneDraws.push({
          whole: args.length === 4 || (args.length === 8 && args[0] === 0 && args[1] === 0 && args[2] === image.naturalWidth && args[3] === image.naturalHeight),
          clipped: corners.some((point) => point.x < -0.5 || point.y < -0.5 || point.x > this.canvas.width + 0.5 || point.y > this.canvas.height + 0.5),
        });
      }
      return drawImage.call(this, image, ...args);
    };
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
      if (this.canvas.closest(".story-ornament--bone") && this.globalCompositeOperation === "destination-out") {
        const matrix = this.getTransform();
        const left = Math.max(0, Math.floor(x * matrix.a));
        const top = Math.max(0, Math.floor(y * matrix.d));
        const right = Math.min(this.canvas.width, Math.ceil((x + width) * matrix.a));
        const bottom = Math.min(this.canvas.height, Math.ceil((y + height) * matrix.d));
        if (right > left && bottom > top) {
          const pixels = this.getImageData(left, top, right - left, bottom - top).data;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 10) window.boneRemovedPixels += 1;
        }
      }
      return fillRect.call(this, x, y, width, height);
    };
  });
  // A local, same-origin route makes canvas pixels inspectable without a server.
  await rendered.route("https://belongs.test/**", async (route) => {
    const resource = path.resolve(root, `.${new URL(route.request().url()).pathname}`);
    if (!resource.startsWith(`${root}${path.sep}`) || !existsSync(resource)) return route.fulfill({ status: 404, body: "Not found" });
    await route.fulfill({ path: resource });
  });
  const errors = [];
  rendered.on("pageerror", (error) => errors.push(error.message));
  await rendered.goto("https://belongs.test/brand-story.html");
  for (const width of [1440, 1024, 390, 320, 1280]) {
    await rendered.setViewportSize({ width, height: 900 });
    await rendered.waitForFunction(() => [...document.querySelectorAll(".story-ornament")].every((element) => element.dataset.ornamentState === "ready" && Math.abs(element.getBoundingClientRect().width - document.documentElement.clientWidth) < 1));
    await rendered.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const scenes = await rendered.locator(".story-ornament canvas").evaluateAll((canvases) => {
      const protectedBoxes = [...document.querySelectorAll(".story-sketch, .philosophy-introduction, .brand-illustration")].map((element) => element.getBoundingClientRect());
      const [sketch, introduction, portrait] = protectedBoxes;
      return canvases.map((canvas) => {
        const bounds = canvas.getBoundingClientRect();
        const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        const scale = canvas.width / bounds.width;
        let ink = 0;
        let obscured = 0;
        let left = 0;
        let right = 0;
        let turned = 0;
        for (let y = 0; y < canvas.height; y += 3) {
          for (let x = 0; x < canvas.width; x += 3) {
            if (pixels[(y * canvas.width + x) * 4 + 3] < 10) continue;
            ink += 1;
            const px = bounds.x + x / scale;
            const py = bounds.y + y / scale;
            if (protectedBoxes.some((box) => px >= box.left - 8 && px <= box.right + 8 && py >= box.top - 8 && py <= box.bottom + 8)) obscured += 1;
            if (px < sketch.left - 12) left += 1;
            if (px > portrait.right + 12) right += 1;
            if (py > introduction.bottom + 12 && py < portrait.top - 12 && px > sketch.left) turned += 1;
            if (py > portrait.bottom + 12 && px < portrait.right) turned += 1;
          }
        }
        return { ink, obscured, left, right, turned };
      });
    });
    for (const scene of scenes) {
      assert.ok(scene.ink > 100, "ornament canvases must not be blank");
      assert.equal(scene.obscured, 0, "not a single sampled ornament pixel may cover the image or text's clear area");
      assert.ok(scene.turned > 30, "the path should continue around the image corner into the lower whitespace");
    }
    if (width >= 1024) {
      assert.ok(scenes[0].left > 100 && scenes[1].right > 100, "both margins should contain visible photographic ornament");
    }
  }
  const boneDetails = await rendered.evaluate(() => ({ draws: window.boneDraws, removed: window.boneRemovedPixels }));
  assert.ok(boneDetails.draws.length > 20);
  assert.ok(boneDetails.draws.every((draw) => draw.whole), "place complete photographic bone units, without skipping source columns");
  assert.ok(boneDetails.draws.every((draw) => !draw.clipped), "a complete bone unit must fit the ornament canvas, including its outer hooks");
  assert.equal(boneDetails.removed, 0, "the text/image safety mask must not erase any bone details");
  assert.deepEqual(errors, []);
  await rendered.close();
  const failedAsset = await browser.newPage();
  await failedAsset.route("**/*-cutout.png", (route) => route.abort());
  await failedAsset.goto(`file://${path.join(root, "brand-story.html")}`);
  await failedAsset.waitForFunction(() => [...document.querySelectorAll(".story-ornament")].every((element) => element.dataset.ornamentState === "unavailable"));
  assert.equal(await failedAsset.locator(".brand-illustration img").isVisible(), true, "a missing decorative asset must not hide the actual content");
  await failedAsset.close();
  const staticPage = await browser.newPage({ javaScriptEnabled: false });
  await staticPage.goto(`file://${path.join(root, "brand-story.html")}`);
  assert.equal(await staticPage.locator(".story-ornament canvas").count(), 0);
  assert.equal(await staticPage.locator(".brand-illustration img").isVisible(), true);
  await staticPage.close();
  console.log("PASS photo-derived transparent ornaments, winding trails and responsive whitespace");
} finally {
  await browser.close();
}
