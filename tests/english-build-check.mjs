import assert from "node:assert/strict";
import { translateLines } from "../scripts/build-english-album.mjs";

const missing = new Set();
const translated = translateLines("羽翼\r\n\r\n固定造型独立雕刻\nS925 Au750\n", {
  "羽翼": "Wings",
  "固定造型独立雕刻": "Established form, individually carved",
}, missing);
assert.equal(translated, "Wings\r\n\r\nEstablished form, individually carved\nS925 Au750\n");
assert.equal(missing.size, 0);
assert.equal(translateLines("", {}), "");
assert.equal(translateLines("  羽翼  ", { "羽翼": "Wings" }), "Wings");
assert.equal(translateLines("羽翼\n旧作", { "羽翼": "Wings" }, missing), "Wings\n旧作");
assert.deepEqual([...missing], ["旧作"]);
translateLines("不良译文", { "不良译文": "one\ntwo" }, missing);
translateLines("未译内容", { "未译内容": "仍是中文" }, missing);
translateLines("误删内容", { "误删内容": "  " }, missing);
assert.ok(missing.has("不良译文") && missing.has("未译内容"));
assert.ok(missing.has("误删内容"), "A Chinese source line cannot disappear in translation");
console.log("PASS exact-line English assembly, unchanged blanks/line endings/units, and explicit missing/invalid translation failures");
