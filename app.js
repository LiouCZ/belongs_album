const state = {
  items: [],
  groups: [],
  filtered: [],
  query: "",
  collection: "all",
  year: "all",
  page: 1,
  pageSize: 20,
  activeGroup: null,
  activeImageIndex: 0,
};

const els = {
  totalCount: document.querySelector("#totalCount"),
  visibleCount: document.querySelector("#visibleCount"),
  searchInput: document.querySelector("#searchInput"),
  pageSizeSelect: document.querySelector("#pageSizeSelect"),
  collectionFilter: document.querySelector("#collectionFilter"),
  yearFilter: document.querySelector("#yearFilter"),
  summaryText: document.querySelector("#summaryText"),
  gallery: document.querySelector("#gallery"),
  pagination: document.querySelector("#pagination"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  pageInfo: document.querySelector("#pageInfo"),
  emptyState: document.querySelector("#emptyState"),
  dialog: document.querySelector("#detailDialog"),
  closeDialog: document.querySelector("#closeDialog"),
  detailImage: document.querySelector("#detailImage"),
  carouselControls: document.querySelector("#carouselControls"),
  carouselCount: document.querySelector("#carouselCount"),
  prevImage: document.querySelector("#prevImage"),
  nextImage: document.querySelector("#nextImage"),
  detailMeta: document.querySelector("#detailMeta"),
  detailTitle: document.querySelector("#detailTitle"),
  detailIndex: document.querySelector("#detailIndex"),
  detailCaption: document.querySelector("#detailCaption"),
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function groupText(value) {
  return normalize(value).replace(/\s+/g, "");
}

function groupKey(item) {
  return [item.collection, item.date, item.title, item.caption].map(groupText).join("|");
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
  const options = ["all", ...years];
  els.yearFilter.innerHTML = options
    .map((year) => {
      const label = year === "all" ? "全部" : year;
      return `<button class="chip ${year === state.year ? "is-active" : ""}" type="button" data-year="${year}">${label}</button>`;
    })
    .join("");
}

function renderCollectionFilter(collections) {
  if (!els.collectionFilter) return;
  const options = ["all", ...collections];
  els.collectionFilter.innerHTML = options
    .map((collection) => {
      const label = collection === "all" ? "全部合集" : collection;
      return `<button class="chip ${collection === state.collection ? "is-active" : ""}" type="button" data-collection="${escapeHtml(collection)}">${escapeHtml(label)}</button>`;
    })
    .join("");
}

function renderCards(items) {
  els.gallery.innerHTML = items
    .map(
      (item) => `
        <article class="card" tabindex="0" role="button" data-id="${escapeHtml(item.id)}" aria-label="查看 ${escapeHtml(item.title)}">
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
  els.prevPage.disabled = state.page <= 1;
  els.nextPage.disabled = state.page >= pages;
}

function applyFilters() {
  const query = normalize(state.query);
  state.filtered = state.groups.filter((item) => {
    const collectionMatches = state.collection === "all" || item.collection === state.collection;
    const yearMatches = state.year === "all" || item.years.includes(state.year);
    const queryMatches = !query || searchableText(item).includes(query);
    return collectionMatches && yearMatches && queryMatches;
  });
  state.page = Math.min(Math.max(1, state.page), totalPages());

  els.visibleCount.textContent = state.filtered.length;
  els.totalCount.textContent = state.groups.length;
  els.summaryText.textContent = buildSummary();
  els.emptyState.hidden = state.filtered.length > 0;
  renderCollectionFilter([...new Set(state.items.map((item) => item.collection || "未分类"))].sort());
  renderYearFilter([...new Set(state.items.map((item) => item.year))].sort());
  renderPagination();
  renderCards(pageItems());
}

function buildSummary() {
  const collectionLabel = els.collectionFilter ? (state.collection === "all" ? "全部合集" : state.collection) : "";
  const yearLabel = state.year === "all" ? "全部年份" : `${state.year} 年`;
  const queryLabel = state.query ? `，关键词「${state.query}」` : "";
  const imageCount = state.filtered.reduce((total, group) => total + group.imageCount, 0);
  const scopeLabel = collectionLabel ? `${collectionLabel} · ` : "";
  return `${scopeLabel}${yearLabel}${queryLabel}：找到 ${state.filtered.length} 组图文，${imageCount} 张图片。当前第 ${state.page}/${totalPages()} 页，每页 ${state.pageSize} 组。`;
}

function sourceRange(group) {
  const indexes = group.items.map((item) => item.sourceIndex);
  const min = Math.min(...indexes);
  const max = Math.max(...indexes);
  return min === max ? `${min}` : `${min}-${max}`;
}

function renderDetailImage() {
  if (!state.activeGroup) return;
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
  els.detailMeta.textContent = `${group.date} · ${group.year}`;
  els.detailTitle.textContent = group.title;
  els.detailIndex.textContent = `${group.year} 第 ${String(group.index).padStart(3, "0")} 组 · ${group.imageCount} 张图片 · 全集 Item ${sourceRange(group)}`;
  els.detailCaption.textContent = group.caption || "无文字说明";
  if (typeof els.dialog.showModal === "function") {
    els.dialog.showModal();
  } else {
    els.dialog.setAttribute("open", "");
  }
}

function closeDetail() {
  els.dialog.close();
  els.detailImage.removeAttribute("src");
  state.activeGroup = null;
  state.activeImageIndex = 0;
}

function bindEvents() {
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

  if (els.collectionFilter) {
    els.collectionFilter.addEventListener("click", (event) => {
      const button = event.target.closest("[data-collection]");
      if (!button) return;
      state.collection = button.dataset.collection;
      state.page = 1;
      applyFilters();
    });
  }

  els.yearFilter.addEventListener("click", (event) => {
    const button = event.target.closest("[data-year]");
    if (!button) return;
    state.year = button.dataset.year;
    state.page = 1;
    applyFilters();
  });

  els.prevPage.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    applyFilters();
  });

  els.nextPage.addEventListener("click", () => {
    state.page = Math.min(totalPages(), state.page + 1);
    applyFilters();
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
  state.items = data.items || [];
  state.groups = createGroups(state.items);
  state.filtered = state.items;
  applyFilters();
}

init().catch((error) => {
  console.error(error);
  els.summaryText.textContent = "加载失败，请确认 data/items.json 存在。";
  els.emptyState.hidden = false;
});
