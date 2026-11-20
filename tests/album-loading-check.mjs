import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(path.join(root, "app.js"), "utf8");
const ids = ["totalCount", "visibleCount", "searchInput", "pageSizeSelect", "summaryText", "gallery",
  "pagination", "firstPage", "prevPage", "pageNumbers", "nextPage", "lastPage", "pageInfo", "emptyState",
  "detailDialog", "closeDialog", "detailImage", "carouselControls", "carouselCount", "prevImage", "nextImage",
  "detailMeta", "detailTitle", "detailIndex", "detailCaption", "openArticle", "articleDialog", "articleDialogMeta", "articleBody", "closeArticle"];

function load({ width = 1440, storage = new Map(), blocked = false, player = false, observe = true } = {}) {
  const nodes = new Map([...ids, ...(player ? ["playerAlbum"] : [])].map((id) => [id, {
    innerHTML: "", textContent: "", hidden: false, value: "", handlers: {},
    classList: { toggle() {} },
    setAttribute() {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
    showModal() { this.open = true; },
    close() { this.open = false; },
  }]));
  const events = {};
  const errors = [];
  const observers = [];
  let articleImages = [];
  nodes.get("articleBody").querySelectorAll = () => {
    articleImages = [...nodes.get("articleBody").innerHTML.matchAll(/<img\b[^>]*data-src="([^"]+)"[^>]*>/g)].map((match) => ({
      dataset: { src: match[1] }, src: "", removeAttribute(name) { if (name === "data-src") delete this.dataset.src; },
    }));
    return articleImages;
  };
  const window = {
    location: { search: "" }, innerWidth: width,
    matchMedia: (query) => ({ matches: query === "(max-width: 680px)" ? window.innerWidth <= 680 : false, addEventListener() {} }),
    addEventListener(type, handler) { events[type] = handler; },
    scrollTo() {},
    get localStorage() {
      if (blocked) throw new Error("Storage blocked");
      return { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    },
  };
  if (observe) window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() { this.disconnected = true; }
  };
  const context = vm.createContext({ window, document: { querySelector: (selector) => nodes.get(selector.slice(1)) || null },
    URLSearchParams, console: { error: (error) => errors.push(error), log() {} } });
  for (const file of [player ? "data/player-items.js" : "data/items.js", ...(!player ? ["data/curated-official.js"] : []), "reading-layout.js"]) {
    vm.runInContext(readFileSync(path.join(root, file), "utf8"), context);
  }
  vm.runInContext(app, context);
  assert.deepEqual(errors, [], "page initialization must succeed");
  return { context, nodes, window, events, storage, observers, articleImages: () => articleImages,
    count: () => (nodes.get("gallery").innerHTML.match(/data-id=/g) || []).length,
    choose(value) { nodes.get("pageSizeSelect").handlers.change({ target: { value: String(value) } }); },
  };
}

for (const player of [false, true]) {
  for (const [width, expected] of [[1440, 10], [681, 10], [680, 5], [390, 5], [320, 5]]) {
    const page = load({ width, player });
    assert.equal(page.count(), expected, `${player ? "player" : "official"} ${width}px default cards`);
    assert.equal(page.nodes.get("pageSizeSelect").value, String(expected));
    assert.equal(page.storage.size, 0, "device defaults must not become a saved preference");
    page.nodes.get("nextPage").handlers.click();
    assert.equal(vm.runInContext("state.page", page.context), 2);
    assert.equal(page.count(), expected);
    page.choose(25);
    assert.equal(page.count(), 25);
    assert.equal(vm.runInContext("state.page", page.context), 1, "changing size resets pagination");
    assert.equal(load({ width: 320, player: !player, storage: page.storage }).count(), 25, "manual choice persists across albums");
    page.window.innerWidth = 320;
    page.events.resize?.();
    page.events["belongs:language-change"]();
    assert.equal(page.count(), 25, "resize and language changes preserve manual choice");
  }
}

for (const saved of [5, 10, 20, 25, 100]) {
  const storage = new Map([["belongs:page-size", String(saved)]]);
  assert.equal(load({ storage }).count(), saved);
}
for (const saved of ["", "0", "15", "-5", "105", "abc", "Infinity", "10.5"]) {
  assert.equal(load({ width: 390, storage: new Map([["belongs:page-size", saved]]) }).count(), 5, `invalid saved size: ${saved}`);
}
const blocked = load({ blocked: true });
assert.equal(blocked.count(), 10);
blocked.choose(5);
assert.equal(blocked.count(), 5, "blocked storage must not break manual selection");
blocked.choose(15);
assert.equal(blocked.count(), 5, "invalid selection must not change the current size");

const articlePage = load();
vm.runInContext("openArticle(state.articles.keys().next().value)", articlePage.context);
const images = articlePage.nodes.get("articleBody").innerHTML.match(/<img\b[^>]+>/g);
assert.ok(images.length > 0);
for (const image of images) {
  assert.match(image, /data-src="assets\//, "defer the actual request until the image approaches the dialog viewport");
  assert.doesNotMatch(image, /\ssrc=/, "opening the article must not eagerly request every image");
  assert.match(image, /loading="lazy"/, "full-article images should load near the viewport");
  assert.match(image, /decoding="async"/);
  assert.match(image, /width="\d+" height="\d+"/, "reserve image space while loading");
}
assert.ok(articlePage.articleImages().every((image) => !image.src));
articlePage.observers[0].callback([{ target: articlePage.articleImages()[0], isIntersecting: true },
  { target: articlePage.articleImages()[1], isIntersecting: false }]);
assert.match(articlePage.articleImages()[0].src, /^assets\/official-articles\//);
assert.equal(articlePage.articleImages()[1].src, "", "offscreen images stay deferred");
articlePage.nodes.get("articleDialog").handlers.close();
assert.equal(articlePage.observers[0].disconnected, true, "stop observing closed articles");
const fallback = load({ observe: false });
vm.runInContext("openArticle(state.articles.keys().next().value)", fallback.context);
assert.ok(fallback.articleImages().every((image) => image.src), "older browsers retain native lazy loading");
for (const file of ["index.html", "player.html"]) {
  const select = readFileSync(path.join(root, file), "utf8").match(/id="pageSizeSelect"[\s\S]*?<\/select>/)[0];
  assert.deepEqual([...select.matchAll(/<option value="(\d+)"/g)].map((match) => Number(match[1])),
    [5, 10, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
}
const translations = vm.createContext({ window: {} });
vm.runInContext(readFileSync(path.join(root, "locales/en/ui.js"), "utf8"), translations);
assert.equal(translations.window.BELONGS_EN.text["5 组"], "5");
assert.equal(translations.window.BELONGS_EN.text["10 组"], "10");
console.log("PASS responsive defaults, saved selection, safe storage, shared albums, pagination, language changes and lazy article markup");
