const state = {
  items: [],
  groups: [],
  filtered: [],
  query: "",
  collection: "all",
  category: "all",
  categories: [],
  year: "all",
  page: 1,
  pageSize: 20,
  activeGroup: null,
  activeImageIndex: 0,
  articles: new Map(),
  lastDiscoveryId: null,
  view: "grid",
};

const els = {
  totalCount: document.querySelector("#totalCount"),
  visibleCount: document.querySelector("#visibleCount"),
  searchInput: document.querySelector("#searchInput"),
  pageSizeSelect: document.querySelector("#pageSizeSelect"),
  categorySelect: document.querySelector("#categorySelect"),
  collectionFilter: document.querySelector("#collectionFilter"),
  yearFilter: document.querySelector("#yearFilter"),
  playerAlbum: document.querySelector("#playerAlbum"),
  collectionSpotlight: document.querySelector("#collectionSpotlight"),
  collectionCover: document.querySelector("#collectionCover"),
  collectionTitle: document.querySelector("#collectionTitle"),
  collectionCount: document.querySelector("#collectionCount"),
  summaryText: document.querySelector("#summaryText"),
  gallery: document.querySelector("#gallery"),
  albumMain: document.querySelector("#albumMain"),
  viewSwitch: document.querySelector("#viewSwitch"),
  pagination: document.querySelector("#pagination"),
  firstPage: document.querySelector("#firstPage"),
  prevPage: document.querySelector("#prevPage"),
  pageNumbers: document.querySelector("#pageNumbers"),
  nextPage: document.querySelector("#nextPage"),
  lastPage: document.querySelector("#lastPage"),
  pageInfo: document.querySelector("#pageInfo"),
  emptyState: document.querySelector("#emptyState"),
  dialog: document.querySelector("#detailDialog"),
  closeDialog: document.querySelector("#closeDialog"),
  detailImage: document.querySelector("#detailImage"),
  detailFigure: document.querySelector("#detailDialog figure"),
  carouselControls: document.querySelector("#carouselControls"),
  carouselCount: document.querySelector("#carouselCount"),
  prevImage: document.querySelector("#prevImage"),
  nextImage: document.querySelector("#nextImage"),
  detailMeta: document.querySelector("#detailMeta"),
  detailTitle: document.querySelector("#detailTitle"),
  detailIndex: document.querySelector("#detailIndex"),
  detailCaption: document.querySelector("#detailCaption"),
  openArticle: document.querySelector("#openArticle"),
  articleDialog: document.querySelector("#articleDialog"),
  articleDialogMeta: document.querySelector("#articleDialogMeta"),
  articleBody: document.querySelector("#articleBody"),
  closeArticle: document.querySelector("#closeArticle"),
  discovery: document.querySelector(".discovery-strip"),
  dailyPick: document.querySelector("#dailyPick"),
  timeTrace: document.querySelector("#timeTrace"),
  timeTraceLabel: document.querySelector("#timeTraceLabel"),
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function groupText(value) {
  return normalize(value).replace(/\s+/g, "");
}

function groupKey(item) {
  return [item.collection, item.articleId, item.date, item.title, item.caption].map(groupText).join("|");
}

function createGroups(items) {
  const groups = new Map();
  const sortedItems = [...items].sort((a, b) => a.sourceIndex - b.sourceIndex);
  for (const item of sortedItems) {
    const key = groupKey(item);
    if (!groups.has(key)) {
      groups.set(key, {
        id: `group-${groups.size + 1}-${item.id}`,
        key,
        collection: item.collection || "未分类",
        year: item.year,
        date: item.date,
        title: item.title,
        caption: item.caption,
        articleId: item.articleId || null,
        sourceIndex: item.sourceIndex,
        index: item.index,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    imageCount: group.items.length,
    years: [...new Set(group.items.map((item) => item.year))],
    thumb: group.items[0].thumb,
    thumbWidth: group.items[0].thumbWidth,
    thumbHeight: group.items[0].thumbHeight,
    image: group.items[0].image,
  }));
}

function sortOfficialGroups(groups) {
  let previousYear = null;
  let previousDateKey = null;
  return groups.map((group) => {
    if (group.year !== previousYear) {
      previousYear = group.year;
      previousDateKey = null;
    }
    const explicitDateKey = datedGroup(group)?.key;
    if (explicitDateKey !== undefined) previousDateKey = explicitDateKey;
    return { group, dateKey: explicitDateKey ?? previousDateKey ?? Number(group.year) * 10000 };
  }).sort((a, b) => a.dateKey - b.dateKey || a.group.sourceIndex - b.group.sourceIndex)
    .map(({ group }) => group);
}

function searchableText(group) {
  const itemText = group.items
    .map((item) => [item.year, item.date, item.title, item.caption, item.index, item.sourceIndex].join(" "))
    .join(" ");
  return normalize([group.collection, group.year, group.date, group.title, group.caption, group.imageCount, itemText].join(" "));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function excerpt(text, maxLength = 110) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "无文字说明";
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength).trim()}...` : cleaned;
}

function renderYearFilter(years) {
  if (!els.yearFilter) return;
  const options = ["all", ...years]
    .map((year) => {
      const label = year === "all" ? "全部年份" : `${year} 年`;
      return `<option value="${escapeHtml(year)}">${escapeHtml(label)}</option>`;
    })
    .join("");
  els.yearFilter.querySelectorAll("option").forEach((option) => option.remove());
  els.yearFilter.insertAdjacentHTML("beforeend", options);
  els.yearFilter.value = state.year;
}

function renderCollectionFilter(collections) {
  if (!els.collectionFilter) return;
  const options = collections.length > 1 ? ["all", ...collections] : collections;
  els.collectionFilter.innerHTML = options
    .map((collection) => {
      const label = collection === "all" ? "全部合集" : collection;
      return `<button class="chip ${collection === state.collection ? "is-active" : ""}" type="button" data-collection="${escapeHtml(collection)}" aria-pressed="${collection === state.collection}">${escapeHtml(label)}</button>`;
    })
    .join("");
}

function renderCategoryFilter(groups) {
  if (!els.categorySelect) return;
  const counts = new Map();
  for (const group of groups) {
    for (const category of group.categories) counts.set(category, (counts.get(category) || 0) + 1);
  }
  const option = (value, label, count, disabled = false) =>
    `<option value="${escapeHtml(value)}"${disabled ? " disabled" : ""}><span class="select-option-label">${escapeHtml(label)}</span> <span class="select-option-count">${count} 组</span></option>`;
  const options = option("all", "全部品类", groups.length) + state.categories.map((category) => {
    const count = counts.get(category) || 0;
    return option(category, category, count, count === 0 && category !== state.category);
  }).join("");
  // Keep the native select button and its keyboard focus while counts refresh.
  els.categorySelect.querySelectorAll("option").forEach((option) => option.remove());
  els.categorySelect.insertAdjacentHTML("beforeend", options);
  els.categorySelect.value = state.category;
}

function renderCollectionSpotlight() {
  if (!els.collectionSpotlight) return;
  const groups = state.groups.filter((group) => state.collection === "all" || group.collection === state.collection);
  const cover = groups[0];
  els.collectionSpotlight.hidden = !cover;
  if (!cover) return;
  els.collectionCover.src = cover.thumb;
  els.collectionTitle.textContent = state.collection === "all" ? "玩家分享合集" : state.collection;
  const imageCount = groups.reduce((total, group) => total + group.imageCount, 0);
  els.collectionCount.textContent = `${groups.length} 组作品 · ${imageCount} 张图片`;
}

function renderCards(items) {
  if (els.playerAlbum) {
    els.gallery.innerHTML = items.map((item) => `
      <article class="card player-card" tabindex="0" role="button" data-id="${escapeHtml(item.id)}" aria-label="查看 ${escapeHtml(item.title)}">
        <div class="thumb">
          <img src="${escapeHtml(item.thumb)}" alt="${escapeHtml(item.title)}" loading="lazy" width="${item.thumbWidth}" height="${item.thumbHeight}" />
          ${item.imageCount > 1 ? `<span class="image-count">${item.imageCount} 张</span>` : ""}
        </div>
        <div class="card-body">
          <h3>${escapeHtml(item.title)}</h3>
          ${item.caption ? `<p class="excerpt">${escapeHtml(excerpt(item.caption))}</p>` : ""}
        </div>
      </article>
    `).join("");
    return;
  }
  if (els.viewSwitch && state.view === "list") {
    els.gallery.innerHTML = items.map((item) => `
      <article class="card card-list ${item.articleId ? "curated-card" : ""}" tabindex="0" role="button" data-id="${escapeHtml(item.id)}" aria-label="查看 ${escapeHtml(item.title)}">
        <div class="thumb"><img src="${escapeHtml(item.thumb)}" alt="${escapeHtml(item.title)}" loading="lazy" width="${item.thumbWidth}" height="${item.thumbHeight}" /></div>
        <div class="card-body">
          <p class="meta">${escapeHtml(item.date)}</p>
          <div class="list-details">
            <span class="list-count">${escapeHtml(item.year)} · ${item.imageCount} 张</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="excerpt">${escapeHtml(excerpt(item.caption))}</p>
          </div>
          <svg class="list-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>
        </div>
      </article>
    `).join("");
    return;
  }
  els.gallery.innerHTML = items
    .map(
      (item) => `
        <article class="card ${item.articleId ? "curated-card" : ""}" tabindex="0" role="button" data-id="${escapeHtml(item.id)}" aria-label="查看 ${escapeHtml(item.title)}">
          <div class="thumb">
            <img src="${escapeHtml(item.thumb)}" alt="${escapeHtml(item.title)}" loading="lazy" width="${item.thumbWidth}" height="${item.thumbHeight}" />
            ${item.imageCount > 1 ? `<span class="image-count">${item.imageCount} 张</span>` : ""}
          </div>
          <div class="card-body">
            <p class="meta">${escapeHtml(item.date)} · ${escapeHtml(item.year)}</p>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="excerpt">${escapeHtml(excerpt(item.caption))}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function setView(view, updateUrl = false) {
  if (!els.viewSwitch) return;
  const nextView = view === "list" ? "list" : "grid";
  if (updateUrl && nextView === state.view) return;
  state.view = nextView;
  els.albumMain.classList.toggle("is-list-view", nextView === "list");
  document.body.classList.toggle("view-list-page", nextView === "list");
  els.searchInput.placeholder = nextView === "list"
    ? "搜索标题、日期或内容"
    : "输入标题、日期、年份、材质、关键词...";
  for (const button of els.viewSwitch.querySelectorAll("[data-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.view === nextView));
  }
  if (updateUrl) {
    const url = new URL(window.location.href);
    if (nextView === "list") url.searchParams.set("view", "list");
    else url.searchParams.delete("view");
    window.history.pushState(null, "", url);
  }
  renderCards(pageItems());
}

function datedGroup(group) {
  const match = String(group.date || "").match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { group, year, month, day, key: year * 10000 + month * 100 + day };
}

function renderDiscovery() {
  if (!els.discovery) return;
  const now = new Date();
  const todayKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const dated = state.groups.map(datedGroup).filter(Boolean);
  const eligible = dated.filter((entry) => entry.key <= todayKey);
  const dailyPool = eligible.length ? eligible : dated;
  if (!dailyPool.length) {
    els.discovery.hidden = true;
    return;
  }

  const freshPool = dailyPool.filter((entry) => entry.group.id !== state.lastDiscoveryId);
  const selectable = freshPool.length ? freshPool : dailyPool;
  const daily = selectable[Math.floor(Math.random() * selectable.length)].group;
  state.lastDiscoveryId = daily.id;
  els.dailyPick.dataset.discoveryId = daily.id;
  els.dailyPick.setAttribute("aria-label", `查看今日一件：${daily.title}`);
  els.dailyPick.innerHTML = `<img src="${escapeHtml(daily.thumb)}" alt="" width="${daily.thumbWidth}" height="${daily.thumbHeight}" /><span><strong>${escapeHtml(daily.title)}</strong><small>${escapeHtml(daily.date)}</small></span>`;

  const past = dated.filter((entry) => entry.year < now.getFullYear());
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const exact = past.filter((entry) => entry.month === month && entry.day === day);
  const sameMonth = past.filter((entry) => entry.month === month);
  const tracePool = [...(exact.length ? exact : sameMonth.length ? sameMonth : past)];
  for (let index = tracePool.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [tracePool[index], tracePool[randomIndex]] = [tracePool[randomIndex], tracePool[index]];
  }
  const trace = tracePool.slice(0, 3);
  const monthNames = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
  els.timeTraceLabel.textContent = exact.length
    ? `往年今日 · ${month}月${day}日`
    : sameMonth.length ? `${monthNames[month - 1]}月旧作` : "往年作品";
  els.timeTrace.innerHTML = trace.map(({ group }) => `
    <button type="button" class="discovery-trace-item" data-discovery-id="${escapeHtml(group.id)}" title="查看${escapeHtml(group.title)}" aria-label="查看${escapeHtml(group.title)}">
      <img src="${escapeHtml(group.thumb)}" alt="" width="${group.thumbWidth}" height="${group.thumbHeight}" />
      <span><strong>${escapeHtml(group.title)}</strong><small>${escapeHtml(group.date)}</small></span>
    </button>
  `).join("");
}

function totalPages() {
  return Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
}

function pageItems() {
  const start = (state.page - 1) * state.pageSize;
  return state.filtered.slice(start, start + state.pageSize);
}

function renderPagination() {
  const pages = totalPages();
  state.page = Math.min(Math.max(1, state.page), pages);
  els.pagination.hidden = state.filtered.length === 0;
  els.pageInfo.textContent = `第 ${state.page} / ${pages} 页`;
  els.firstPage.disabled = els.prevPage.disabled = state.page <= 1;
  els.nextPage.disabled = els.lastPage.disabled = state.page >= pages;
  const first = Math.max(1, Math.min(state.page - 2, pages - 4));
  const last = Math.min(pages, first + 4);
  els.pageNumbers.innerHTML = `${first > 1 ? '<span class="page-gap" aria-hidden="true">…</span>' : ""}${Array.from(
    { length: last - first + 1 },
    (_, offset) => {
      const page = first + offset;
      return `<button type="button" data-page="${page}" aria-label="第 ${page} 页"${page === state.page ? ' class="is-current" aria-current="page"' : ""}>${page}</button>`;
    }
  ).join("")}${last < pages ? '<span class="page-gap" aria-hidden="true">…</span>' : ""}`;
}

function applyFilters() {
  const query = normalize(state.query);
  const matching = state.groups.filter((item) => {
    const collectionMatches = state.collection === "all" || item.collection === state.collection;
    const yearMatches = state.year === "all" || item.years.includes(state.year);
    const queryMatches = !query || searchableText(item).includes(query);
    return collectionMatches && yearMatches && queryMatches;
  });
  renderCategoryFilter(matching);
  state.filtered = matching.filter((item) => state.category === "all" || item.categories.includes(state.category));
  state.page = Math.min(Math.max(1, state.page), totalPages());

  els.visibleCount.textContent = state.filtered.length;
  els.totalCount.textContent = state.groups.length;
  els.summaryText.textContent = buildSummary();
  els.emptyState.hidden = state.filtered.length > 0;
  renderCollectionFilter([...new Set(state.items.map((item) => item.collection || "未分类"))].sort());
  renderCollectionSpotlight();
  renderPagination();
  renderCards(pageItems());
}

function buildSummary() {
  const collectionLabel = els.collectionFilter ? (state.collection === "all" ? "全部合集" : state.collection) : "";
  const queryLabel = state.query ? `，关键词「${state.query}」` : "";
  const imageCount = state.filtered.reduce((total, group) => total + group.imageCount, 0);
  if (els.playerAlbum) {
    return `${collectionLabel}${queryLabel}：找到 ${state.filtered.length} 组图文，${imageCount} 张图片。当前第 ${state.page}/${totalPages()} 页，每页 ${state.pageSize} 组。`;
  }
  const yearLabel = state.year === "all" ? "全部年份" : `${state.year} 年`;
  const scopeLabel = collectionLabel ? `${collectionLabel} · ` : "";
  const categoryLabel = state.category === "all" ? "" : ` · ${state.category}`;
  return `${scopeLabel}${yearLabel}${categoryLabel}${queryLabel}：找到 ${state.filtered.length} 组图文，${imageCount} 张图片。当前第 ${state.page}/${totalPages()} 页，每页 ${state.pageSize} 组。`;
}

function sourceRange(group) {
  const indexes = group.items.map((item) => item.sourceIndex);
  const min = Math.min(...indexes);
  const max = Math.max(...indexes);
  return min === max ? `${min}` : `${min}-${max}`;
}

function renderDetailImage() {
  if (!state.activeGroup) return;
  resetImageInspection();
  const item = state.activeGroup.items[state.activeImageIndex];
  els.detailImage.src = item.image;
  els.detailImage.alt = state.activeGroup.title;
  els.carouselCount.textContent = `${state.activeImageIndex + 1} / ${state.activeGroup.imageCount}`;
  els.carouselControls.hidden = state.activeGroup.imageCount <= 1;
}

function moveDetailImage(delta) {
  if (!state.activeGroup || state.activeGroup.imageCount <= 1) return;
  state.activeImageIndex = (state.activeImageIndex + delta + state.activeGroup.imageCount) % state.activeGroup.imageCount;
  renderDetailImage();
}

function openDetail(group) {
  state.activeGroup = group;
  state.activeImageIndex = 0;
  renderDetailImage();
  els.detailTitle.textContent = group.title;
  if (els.playerAlbum) {
    els.detailMeta.textContent = group.collection;
    els.detailIndex.textContent = `第 ${String(group.index).padStart(2, "0")} 组 · ${group.imageCount} 张图片`;
    els.detailCaption.textContent = group.caption;
    els.detailCaption.hidden = !group.caption;
  } else {
    els.detailMeta.textContent = `${group.date} · ${group.year}`;
    els.detailIndex.textContent = `${group.year} 第 ${String(group.index).padStart(3, "0")} 组 · ${group.imageCount} 张图片 · 全集 Item ${sourceRange(group)}`;
    els.detailCaption.textContent = group.caption || "无文字说明";
    els.detailCaption.hidden = false;
    els.openArticle.hidden = !group.articleId;
  }
  if (typeof els.dialog.showModal === "function") {
    els.dialog.showModal();
  } else {
    els.dialog.setAttribute("open", "");
  }
}

function openArticle(articleId) {
  const article = state.articles.get(articleId);
  if (!article || !els.articleDialog) return;
  els.articleDialogMeta.textContent = `${article.account} · ${article.date} · ${article.works.length} 件作品`;
  els.articleBody.innerHTML = `
    <div class="article-work-grid">${article.works.map((work, index) => `
      <figure class="article-work">
        <div class="article-work-images">${work.images.map((image) => `
          <img src="${escapeHtml(image.path)}" alt="${escapeHtml(work.title)}" width="${image.width}" height="${image.height}" />
        `).join("")}</div>
        <figcaption>
          <span class="article-work-number">${String(index + 1).padStart(2, "0")}</span>
          <div><h3>${escapeHtml(work.title)}</h3><p>${escapeHtml(work.description)}</p></div>
        </figcaption>
      </figure>
    `).join("")}</div>
    ${article.theme ? `<footer class="article-theme">
      <div><span>末尾主题描述</span><time class="article-theme-date">${escapeHtml(article.theme.date)}</time></div>
      <blockquote class="article-theme-text">${escapeHtml(article.theme.text)}</blockquote>
      <a href="${escapeHtml(article.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看公众号原文 ↗</a>
    </footer>` : `<footer class="article-theme article-theme-source"><a href="${escapeHtml(article.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看公众号原文 ↗</a></footer>`}
  `;
  els.articleDialog.scrollTop = 0;
  els.articleDialog.showModal();
}

function closeDetail() {
  els.dialog.close();
  resetImageInspection();
  els.detailImage.removeAttribute("src");
  state.activeGroup = null;
  state.activeImageIndex = 0;
}

const inspectMedia = typeof window.matchMedia === "function"
  ? window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)")
  : { matches: true, addEventListener() {} };
const imageLens = els.detailFigure && typeof document.createElement === "function"
  ? document.createElement("div")
  : null;
if (imageLens) {
  imageLens.id = "detailLens";
  imageLens.className = "detail-lens";
  imageLens.setAttribute("aria-hidden", "true");
  imageLens.hidden = true;
  els.detailFigure.append(imageLens);
}

let lastImageTap = null;
let imageDrag = null;
let imagePanX = 0;
let imagePanY = 0;
let zoomOriginX = 0.5;
let zoomOriginY = 0.5;

function resetImageInspection() {
  if (!imageLens || !els.detailFigure) return;
  imageLens.hidden = true;
  els.detailFigure.classList.remove("is-image-zoomed");
  els.detailImage.classList.remove("is-zoomed");
  els.detailImage.style.removeProperty("--zoom-x");
  els.detailImage.style.removeProperty("--zoom-y");
  els.detailImage.style.removeProperty("--pan-x");
  els.detailImage.style.removeProperty("--pan-y");
  lastImageTap = null;
  imageDrag = null;
  imagePanX = 0;
  imagePanY = 0;
}

function updateImageLens(event) {
  if (!imageLens || !inspectMedia.matches || !els.detailImage.complete || !els.detailImage.naturalWidth) return;
  const imageRect = els.detailImage.getBoundingClientRect();
  const figureRect = els.detailFigure.getBoundingClientRect();
  const size = Math.min(152, imageRect.width, imageRect.height);
  if (size < 90) return;
  const x = Math.max(0, Math.min(event.clientX - imageRect.left, imageRect.width));
  const y = Math.max(0, Math.min(event.clientY - imageRect.top, imageRect.height));
  const zoom = 2.4;
  imageLens.style.width = `${size}px`;
  imageLens.style.height = `${size}px`;
  imageLens.style.left = `${imageRect.left - figureRect.left + Math.max(0, Math.min(x - size / 2, imageRect.width - size))}px`;
  imageLens.style.top = `${imageRect.top - figureRect.top + Math.max(0, Math.min(y - size / 2, imageRect.height - size))}px`;
  imageLens.style.backgroundImage = `url(${JSON.stringify(els.detailImage.currentSrc)})`;
  imageLens.style.backgroundSize = `${imageRect.width * zoom}px ${imageRect.height * zoom}px`;
  imageLens.style.backgroundPosition = `${size / 2 - x * zoom}px ${size / 2 - y * zoom}px`;
  imageLens.hidden = false;
}

function toggleTouchZoom(event) {
  if (!els.detailFigure) return;
  if (els.detailImage.classList.contains("is-zoomed")) {
    resetImageInspection();
    return;
  }
  const rect = els.detailImage.getBoundingClientRect();
  zoomOriginX = Math.max(0, Math.min((event.clientX - rect.left) / rect.width, 1));
  zoomOriginY = Math.max(0, Math.min((event.clientY - rect.top) / rect.height, 1));
  els.detailImage.style.setProperty("--zoom-x", `${zoomOriginX * 100}%`);
  els.detailImage.style.setProperty("--zoom-y", `${zoomOriginY * 100}%`);
  els.detailFigure.classList.add("is-image-zoomed");
  els.detailImage.classList.add("is-zoomed");
}

function bindImageInspection() {
  if (!els.gallery || !els.detailFigure || !els.detailImage) return;
  els.gallery.addEventListener("pointermove", (event) => {
    if (!inspectMedia.matches) return;
    const card = event.target.closest(".card");
    if (!card || !els.gallery.contains(card)) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--glint-x", `${Math.round(event.clientX - rect.left)}px`);
    card.style.setProperty("--glint-y", `${Math.round(event.clientY - rect.top)}px`);
  });

  els.detailImage.draggable = false;
  els.detailImage.addEventListener("pointermove", (event) => {
    if (imageDrag && event.pointerId === imageDrag.pointerId) {
      if (Math.hypot(event.clientX - imageDrag.x, event.clientY - imageDrag.y) > 8) imageDrag.moved = true;
      const width = els.detailImage.offsetWidth;
      const height = els.detailImage.offsetHeight;
      imagePanX = Math.max(-(width * (1 - zoomOriginX)), Math.min(width * zoomOriginX, imageDrag.panX + event.clientX - imageDrag.x));
      imagePanY = Math.max(-(height * (1 - zoomOriginY)), Math.min(height * zoomOriginY, imageDrag.panY + event.clientY - imageDrag.y));
      els.detailImage.style.setProperty("--pan-x", `${imagePanX}px`);
      els.detailImage.style.setProperty("--pan-y", `${imagePanY}px`);
      return;
    }
    updateImageLens(event);
  });
  els.detailImage.addEventListener("pointerleave", () => { imageLens.hidden = true; });
  els.detailImage.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" || !els.detailImage.classList.contains("is-zoomed")) return;
    imageDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: imagePanX, panY: imagePanY, moved: false };
    els.detailImage.setPointerCapture(event.pointerId);
  });
  els.detailImage.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch") return;
    if (imageDrag?.moved) {
      imageDrag = null;
      lastImageTap = null;
      return;
    }
    imageDrag = null;
    const now = performance.now();
    if (lastImageTap && now - lastImageTap.time < 360 && Math.hypot(event.clientX - lastImageTap.x, event.clientY - lastImageTap.y) < 28) {
      event.preventDefault();
      toggleTouchZoom(event);
      lastImageTap = null;
    } else {
      lastImageTap = { time: now, x: event.clientX, y: event.clientY };
    }
  });
  els.detailImage.addEventListener("pointercancel", () => { imageDrag = null; lastImageTap = null; imageLens.hidden = true; });
  inspectMedia.addEventListener("change", () => { imageLens.hidden = true; });
}

function bindEvents() {
  bindImageInspection();
  if (els.viewSwitch) {
    els.viewSwitch.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (button) setView(button.dataset.view, true);
    });
    window.addEventListener("popstate", () => {
      setView(new URLSearchParams(window.location.search).get("view"));
    });
  }

  if (els.discovery) {
    els.discovery.addEventListener("click", (event) => {
      const button = event.target.closest("[data-discovery-id]");
      if (!button) return;
      const group = state.groups.find((candidate) => candidate.id === button.dataset.discoveryId);
      if (group) {
        document.querySelector("#siteEggDialog")?.close();
        openDetail(group);
      }
    });
    window.addEventListener("belongs:refresh-discovery", renderDiscovery);
  }

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.page = 1;
    applyFilters();
  });

  els.pageSizeSelect.addEventListener("change", (event) => {
    state.pageSize = Number(event.target.value) || 20;
    state.page = 1;
    applyFilters();
  });

  if (els.categorySelect) {
    els.categorySelect.addEventListener("change", (event) => {
      state.category = event.target.value;
      state.page = 1;
      applyFilters();
    });
  }

  if (els.collectionFilter) {
    els.collectionFilter.addEventListener("click", (event) => {
      const button = event.target.closest("[data-collection]");
      if (!button) return;
      state.collection = button.dataset.collection;
      state.page = 1;
      applyFilters();
    });
  }

  if (els.yearFilter) {
    els.yearFilter.addEventListener("change", (event) => {
      state.year = event.target.value;
      state.page = 1;
      applyFilters();
    });
  }

  function goToPage(page) {
    state.page = Math.min(Math.max(1, page), totalPages());
    applyFilters();
  }

  els.firstPage.addEventListener("click", () => goToPage(1));
  els.prevPage.addEventListener("click", () => goToPage(state.page - 1));
  els.nextPage.addEventListener("click", () => goToPage(state.page + 1));
  els.lastPage.addEventListener("click", () => goToPage(totalPages()));
  els.pageNumbers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (button) goToPage(Number(button.dataset.page));
  });

  els.gallery.addEventListener("click", (event) => {
    const card = event.target.closest("[data-id]");
    if (!card) return;
    const item = state.groups.find((candidate) => candidate.id === card.dataset.id);
    if (item) openDetail(item);
  });

  els.gallery.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-id]");
    if (!card) return;
    event.preventDefault();
    const item = state.groups.find((candidate) => candidate.id === card.dataset.id);
    if (item) openDetail(item);
  });

  els.prevImage.addEventListener("click", () => moveDetailImage(-1));
  els.nextImage.addEventListener("click", () => moveDetailImage(1));
  els.closeDialog.addEventListener("click", closeDetail);
  if (els.openArticle) {
    els.openArticle.addEventListener("click", () => {
      const articleId = state.activeGroup?.articleId;
      closeDetail();
      openArticle(articleId);
    });
    els.closeArticle.addEventListener("click", () => els.articleDialog.close());
    els.articleDialog.addEventListener("click", (event) => {
      if (event.target === els.articleDialog) els.articleDialog.close();
    });
  }
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeDetail();
  });
}

async function init() {
  bindEvents();
  let data = window.BELONGS_DATA;
  if (!data) {
    const response = await fetch("data/items.json");
    if (!response.ok) {
      throw new Error(`Failed to load data/items.json: ${response.status}`);
    }
    data = await response.json();
  }
  const curated = els.playerAlbum ? null : window.BELONGS_CURATED;
  state.items = [...(data.items || []), ...(curated?.items || [])];
  state.articles = new Map((curated?.articles || []).map((article) => [article.id, article]));
  const groups = createGroups(state.items);
  state.groups = els.playerAlbum ? groups : sortOfficialGroups(groups);
  if (els.categorySelect) {
    state.groups = state.groups.map((group) => ({ ...group, categories: window.BELONGS_CATEGORIES.forGroup(group) }));
    const counts = new Map();
    for (const group of state.groups) {
      for (const category of group.categories) counts.set(category, (counts.get(category) || 0) + 1);
    }
    state.categories = [...counts.keys()].sort((a, b) => (a === "其他图文") - (b === "其他图文") || counts.get(b) - counts.get(a) || a.localeCompare(b, "zh-CN"));
  }
  state.filtered = state.items;
  const collections = [...new Set(state.groups.map((group) => group.collection))];
  if (els.playerAlbum && collections.length === 1) state.collection = collections[0];
  const query = new URLSearchParams(window.location.search).get("q");
  if (query) {
    state.query = query;
    els.searchInput.value = query;
  }
  if (els.viewSwitch) setView(new URLSearchParams(window.location.search).get("view"));
  renderYearFilter([...new Set(state.items.map((item) => item.year))].sort());
  renderDiscovery();
  applyFilters();
}

init().catch((error) => {
  console.error(error);
  els.summaryText.textContent = "加载失败，请确认 data/items.json 存在。";
  els.emptyState.hidden = false;
});
