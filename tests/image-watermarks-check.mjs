import assert from "node:assert/strict";
import { classifyWatermark, photoAssets, watermarkSvg } from "../scripts/image-watermarks.mjs";

assert.equal(classifyWatermark([{ text: "BELONGS OFFICIAL", confidence: 0.9 }]).status, "existing");
assert.equal(classifyWatermark([{ text: "BELONGS B&K", confidence: 0.9 }]).status, "existing");
assert.equal(classifyWatermark([{ text: "BEL0NGS OFFlCIAL", confidence: 0.8 }]).status, "existing");
assert.equal(classifyWatermark([{ text: "BELONGS", confidence: 0.9 }]).status, "review");
assert.equal(classifyWatermark([{ text: "S925 Au750", confidence: 0.9 }]).status, "add");
assert.equal(classifyWatermark([]).status, "add");

const assets = photoAssets([{ image: "assets/images/a.jpg", thumb: "assets/thumbs/a.jpg", largeWidth: 1080, largeHeight: 720, thumbWidth: 420, thumbHeight: 280 },
  { image: "assets/images/a.jpg", thumb: "assets/thumbs/a.jpg", largeWidth: 1080, largeHeight: 720, thumbWidth: 420, thumbHeight: 280 }]);
assert.equal(assets.length, 2, "Repeated references must not add another watermark");
assert.equal(assets[1].master, assets[0].path);
assert.throws(() => photoAssets([{ image: "../outside.jpg" }]), /Invalid photo path/);
assert.throws(() => photoAssets([{ image: "assets/favicon.png" }]), /Invalid photo path/);
assert.match(watermarkSvg(1200, 900, { left: 244, top: 0, width: 710, height: 900 }), /x="936" y="882"/);
assert.throws(() => watermarkSvg(1200, 900, { left: 999, top: 0, width: 710, height: 900 }), /bounds/);
for (const [width, height] of [[1080, 720], [420, 280], [400, 1600]]) {
  const svg = watermarkSvg(width, height);
  assert.match(svg, /BELONGS B&amp;K/);
  assert.match(svg, new RegExp(`width="${width}" height="${height}"`));
  assert.doesNotMatch(svg, /<rect/);
}
console.log("PASS work-photo scope, visible existing watermark detection, ambiguous review, duplicate references and restrained text watermark");
