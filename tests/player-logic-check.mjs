import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = [
  "totalCount", "visibleCount", "searchInput", "pageSizeSelect", "collectionFilter",
  "collectionSpotlight", "collectionCover", "collectionTitle", "collectionCount",
  "summaryText", "gallery", "pagination", "prevPage", "nextPage", "pageInfo",
  "emptyState", "detailDialog", "closeDialog", "detailImage", "carouselControls",
  "carouselCount", "prevImage", "nextImage", "detailMeta", "detailTitle",
  "detailIndex", "detailCaption", "playerAlbum",
];
const nodes = new Map(ids.map((id) => [id, {
  innerHTML: "",
  textContent: "",
  hidden: false,
  value: "",
  handlers: {},
  addEventListener(type, handler) { this.handlers[type] = handler; },
  showModal() { this.open = true; },
  close() { this.open = false; },
}]));
const context = vm.createContext({
  window: { location: { search: "" } },
  document: { querySelector: (selector) => nodes.get(selector.slice(1)) || null },
  URLSearchParams,
  console,
});

vm.runInContext(readFileSync(path.join(root, "data/player-items.js"), "utf8"), context);
vm.runInContext(readFileSync(path.join(root, "app.js"), "utf8"), context);

const node = (id) => nodes.get(id);
assert.equal(node("collectionTitle").textContent, "羽翼合集");
assert.equal(node("collectionCount").textContent, "30 组作品 · 39 张图片");
assert.equal((node("collectionFilter").innerHTML.match(/data-collection=/g) || []).length, 1);
assert.match(node("collectionFilter").innerHTML, /aria-pressed="true"/);
assert.doesNotMatch(node("summaryText").textContent, /未标注/);
assert.equal((node("gallery").innerHTML.match(/class="card player-card"/g) || []).length, 20);
assert.doesNotMatch(node("gallery").innerHTML, /无文字说明|class="excerpt"/);

node("searchInput").handlers.input({ target: { value: "羽翼 #21" } });
assert.equal(node("visibleCount").textContent, 1);
assert.match(node("gallery").innerHTML, /2 张/);
assert.match(node("gallery").innerHTML, /class="excerpt"/);

vm.runInContext("openDetail(state.filtered[0])", context);
assert.equal(node("detailMeta").textContent, "羽翼合集");
assert.equal(node("detailCaption").hidden, false);
vm.runInContext("openDetail(state.groups[0])", context);
assert.equal(node("detailCaption").hidden, true);
assert.doesNotMatch(node("detailIndex").textContent, /未标注/);

vm.runInContext(`
  state.items.push({ ...state.items[0], id: "future-item", sourceIndex: 1000,
    collection: "其他合集", title: "新作品" });
  state.groups = createGroups(state.items);
  state.collection = "all";
  state.query = "";
  applyFilters();
`, context);
assert.equal((node("collectionFilter").innerHTML.match(/data-collection=/g) || []).length, 3);
assert.equal(node("collectionTitle").textContent, "玩家分享合集");
