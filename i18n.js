(() => {
  const storageKey = "belongs:language";
  const supported = (value) => value === "en" ? "en" : value === "zh" || value === "zh-CN" ? "zh" : null;
  let stored;
  try { stored = localStorage.getItem(storageKey); } catch { /* Static files may restrict storage. */ }
  let language = supported(new URLSearchParams(location.search).get("lang")) || supported(stored) || "zh";
  const originals = new WeakMap();
  const originalAttributes = new WeakMap();
  const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const skip = "script, style, textarea, input, svg, [contenteditable], [data-i18n-skip], [data-i18n-content]";
  const routes = new Set(["index.html", "player.html", "brand-story.html", "vip.html", "custom-rules.html"]);

  function t(source, variables = {}) {
    const raw = String(source ?? "");
    const translation = language === "en" ? window.BELONGS_EN?.text?.[normalize(raw)] : undefined;
    return (translation ?? raw).replace(/\{(\w+)\}/g, (match, key) => String(variables[key] ?? match));
  }

  function content(kind, id, field, fallback) {
    const entry = window.BELONGS_EN?.[kind]?.[id]?.[field];
    return language === "en" && entry?.source === fallback && typeof entry.en === "string" ? entry.en : fallback;
  }

  function date(value) {
    if (language !== "en") return value;
    const match = String(value || "").match(/^(\d{4})(?:年\s*|-)(\d{1,2})(?:月\s*|-)(\d{1,2})日?$/);
    if (!match) return String(value || "").replace(/\s*年$/, "");
    const [, year, month, day] = match;
    return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
  }

  function translateNode(node) {
    if (!node.parentElement || node.parentElement.closest(skip)) return;
    const current = node.textContent;
    const previous = originals.get(node);
    const source = previous && current === previous.last ? previous.source : current;
    const copy = t(source);
    const last = copy === source ? source : `${source.match(/^\s*/)[0]}${copy}${source.match(/\s*$/)[0]}`;
    if (current !== last) node.textContent = last;
    originals.set(node, { source, last });
  }

  function translateAttributes(node) {
    if (node.closest("[data-i18n-skip], [data-i18n-content]")) return;
    const saved = originalAttributes.get(node) || {};
    for (const name of ["title", "aria-label", "placeholder", "alt"]) {
      if (!node.hasAttribute(name)) continue;
      const current = node.getAttribute(name);
      const source = saved[name]?.last === current ? saved[name].source : current;
      const last = t(source);
      if (current !== last) node.setAttribute(name, last);
      saved[name] = { source, last };
    }
    originalAttributes.set(node, saved);
  }

  function updateLinks() {
    const explicit = new URLSearchParams(location.search).has("lang");
    for (const link of document.querySelectorAll("a[href]")) {
      const raw = link.getAttribute("href");
      if (!raw || raw.startsWith("#")) continue;
      const url = new URL(raw, location.href);
      if (!routes.has(url.pathname.split("/").pop()) || new URL(".", url).href !== new URL(".", location.href).href) continue;
      if (language === "en" || explicit) url.searchParams.set("lang", language);
      else url.searchParams.delete("lang");
      const target = /^[a-z]+:/i.test(raw) ? url.href : `${url.pathname.split("/").pop()}${url.search}${url.hash}`;
      if (raw !== target) link.setAttribute("href", target);
    }
  }

  function apply(root = document) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateNode(walker.currentNode);
    if (root instanceof Element) translateAttributes(root);
    for (const node of root.querySelectorAll("[title], [aria-label], [placeholder], [alt]")) translateAttributes(node);
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    const select = document.querySelector("#languageSelect");
    if (select) select.value = language;
    updateLinks();
  }

  function setLanguage(value, updateUrl = true) {
    const next = supported(value);
    if (!next) return;
    const changed = next !== language;
    language = next;
    try { localStorage.setItem(storageKey, language); } catch { /* URL links also preserve the selection. */ }
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set("lang", language);
      history.replaceState(history.state, "", url);
    }
    apply();
    if (changed) window.dispatchEvent(new CustomEvent("belongs:language-change", { detail: { language } }));
    apply();
  }

  function mountSelector() {
    const control = document.createElement("label");
    control.className = "language-control";
    control.dataset.html2canvasIgnore = "true";
    control.innerHTML = '<span class="language-label">Language</span><select id="languageSelect" aria-label="Language / 语言"><option value="zh">简体中文</option><option value="en">English</option></select>';
    const mobile = matchMedia("(max-width: 680px)");
    function position() {
      const navigation = document.querySelector(".album-navigation");
      const header = document.querySelector(".album-header");
      const hero = document.querySelector(".vip-hero");
      const parent = navigation && !mobile.matches ? navigation : header || hero;
      if (!parent || control.parentNode === parent) return;
      if (hero === parent) parent.prepend(control);
      else parent.append(control);
    }
    position();
    mobile.addEventListener("change", position);
    control.querySelector("select").addEventListener("change", (event) => setLanguage(event.target.value));
  }

  window.BelongsI18n = Object.freeze({ t, content, date, apply, setLanguage, english: () => language === "en" });
  document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  window.addEventListener("popstate", () => setLanguage(supported(new URLSearchParams(location.search).get("lang")) || "zh", false));
  document.addEventListener("DOMContentLoaded", () => {
    mountSelector();
    apply();
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; apply(); });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["title", "aria-label", "placeholder", "alt", "href"] });
  }, { once: true });
})();
