const stories = window.BELONGS_STORIES || [];
const featured = [
  {
    id: "2021-148-309cfd3f0d",
    title: "侘寂：真实的手工感",
    description: "《侘寂之美》把材料配制、旧化、裂纹与日后的把玩放在一起讨论，也明确指出侘寂不等于粗制滥造。看似不规整的表面，背后仍需要细致的制作。",
  },
  {
    id: "2022-068-bedc317626",
    title: "初心羽：出发的理由",
    description: "《风中飞扬》从“初心”谈到漂流的羽毛，说明这件定款作品是为纪念最初从业时的心路历程。原文称它为 Belongs 的首支定款羽毛，而非品牌第一件羽毛。",
  },
  {
    id: "2021-018-ba5c239f1f",
    title: "手作与独件性",
    description: "《羽翼》记录雕刻和组合带来的细微差异；《等待》《持续创作》则把制作过程中的时间与情感写进作品。手工痕迹在这里不是装饰，而是创作本身留下的记录。",
  },
  {
    id: "2021-023-ab69c9278f",
    title: "鹰、马与蛇的语言",
    description: "鹰的坚毅、马的自由、蛇的守护分别见于不同的官方图文。将它们并置，可以看见 Belongs 如何借自然形象传递祝愿，同时保留每件作品各自的语境。",
  },
  {
    id: "2022-049-8744806369",
    title: "复古文化如何向前",
    description: "《复古文化的未来》没有把传统与发展对立起来，而是把手工、自然与当代生活并置。对原创和文化差异的追问，也延续在《无声生长》《文化与格调》中。",
  },
  {
    id: "2023-018-b95e627edb",
    title: "配件与佩戴者",
    description: "《配件的发售》谈到配件如何调整主件的视觉平衡。作品被佩戴、组合与重新诠释，创作者留下的空间也成为佩戴者参与表达的地方。",
  },
  {
    id: "2023-012-75ae4db4cd",
    title: "灯塔、光与信念",
    description: "《灯塔》把航行者的光与作者仰望十字时获得的信念相连。光、远行和守望在其他作品中反复出现，但这篇文字的个人信仰语境应当保留。",
  },
  {
    id: "2024-142-0b99c0f288",
    title: "麦穗与生长的意象",
    description: "从《收获》中的麦穗、羽翼与沙漏，到后续作品里的葡萄叶和衔尾蛇，自然元素持续进入银饰造型。这是跨年观察线索，并非一篇现成的官方长文。",
  },
];

const state = { year: "all", query: "", page: 1, pageSize: 12 };
const els = {
  features: document.querySelector("#storyFeatureList"),
  catalog: document.querySelector("#storyCatalog"),
  yearFilter: document.querySelector("#storyYearFilter"),
  search: document.querySelector("#storySearch"),
  count: document.querySelector("#storyResultCount"),
  empty: document.querySelector("#storyEmpty"),
  previous: document.querySelector("#storyPrevPage"),
  next: document.querySelector("#storyNextPage"),
  pageInfo: document.querySelector("#storyPageInfo"),
  dialog: document.querySelector("#storySourceDialog"),
  sourceTitle: document.querySelector("#storySourceTitle"),
  sourceNote: document.querySelector("#storySourceNote"),
  sourceBody: document.querySelector("#storySourceBody"),
  sourceClose: document.querySelector("#storySourceClose"),
};

function setupIllustrationVoices() {
  const illustration = document.querySelector(".brand-illustration");
  const headspots = illustration.querySelectorAll(".brand-headspot");

  function showVoice(activeSpot = null) {
    for (const spot of headspots) {
      const open = spot === activeSpot;
      document.getElementById(spot.getAttribute("aria-controls")).hidden = !open;
      spot.setAttribute("aria-expanded", String(open));
    }
  }

  for (const spot of headspots) {
    spot.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") showVoice(spot);
    });
    spot.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") showVoice();
    });
    spot.addEventListener("focus", () => {
      if (spot.matches(":focus-visible")) showVoice(spot);
    });
    spot.addEventListener("blur", () => showVoice());
    spot.addEventListener("click", (event) => {
      const close = event.pointerType === "touch" && spot.getAttribute("aria-expanded") === "true";
      showVoice(close ? null : spot);
    });
  }

  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".brand-headspot")) showVoice();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") showVoice();
  });
}

async function setupStorySketch() {
  const figure = document.querySelector(".story-sketch");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animations = [];
  let observer = null;
  let finishWaiting = null;
  function complete() {
    figure.dataset.sketchState = "complete";
    observer?.disconnect();
    observer = null;
    finishWaiting?.();
    finishWaiting = null;
    for (const animation of animations) animation.cancel();
    animations = [];
  }
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) complete();
  });
  if (reducedMotion.matches || !figure.animate) return complete();

  try {
    const inkImage = new Image();
    inkImage.src = figure.querySelector(".sketch-ink image").getAttribute("href");
    await Promise.all([...figure.querySelectorAll("img"), inkImage].map((image) => image.decode()));
    if (figure.dataset.sketchState === "complete") return;

    if ("IntersectionObserver" in window) {
      figure.dataset.sketchState = "waiting";
      await new Promise((resolve) => {
        finishWaiting = resolve;
        observer = new IntersectionObserver((entries) => {
          if (figure.dataset.sketchState !== "waiting") return;
          if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.2)) return;
          observer.disconnect();
          observer = null;
          finishWaiting = null;
          resolve();
        }, { threshold: 0.2 });
        observer.observe(figure);
      });
      if (figure.dataset.sketchState === "complete") return;
    }

    // These paths reveal the original photographed marks, rather than drawing a substitute illustration.
    const phases = [
      { duration: 700, width: 16, paths: [
        "M177 509 C175 466 181 429 195 380 C214 305 234 235 263 163 C297 91 341 39 408 0",
      ] },
      { duration: 2380, width: 14, paths: [
        "M184 447 Q191 419 215 397",
        "M187 434 Q201 413 229 386",
        "M190 419 Q208 400 236 371",
        "M193 407 Q216 386 247 352",
        "M196 395 Q220 377 256 336",
        "M199 382 Q226 362 266 319",
        "M202 369 Q230 353 278 299",
        "M206 354 Q244 333 292 280",
        "M210 341 Q248 321 306 260",
        "M215 325 Q259 301 318 241",
        "M220 309 Q271 278 331 221",
        "M225 293 Q275 263 342 202",
        "M230 277 Q290 242 349 182",
        "M236 260 Q294 229 355 163",
        "M242 243 Q302 213 357 146",
        "M249 224 Q306 193 366 122",
        "M257 203 Q316 175 377 100",
        "M265 182 Q328 145 389 75",
        "M276 161 Q343 120 400 45",
        "M288 137 Q351 98 408 16",
        "M195 383 Q196 349 210 314",
        "M206 345 Q210 301 226 258",
        "M220 299 Q226 249 244 202",
        "M237 246 Q245 193 265 145",
        "M256 192 Q269 133 291 81",
        "M283 131 Q309 70 350 16",
        "M315 83 Q352 39 382 0",
      ] },
      { duration: 1500, width: 15, paths: [
        "M305 326 Q307 314 321 311 Q326 324 318 351",
        "M302 322 C309 307 329 303 337 314 Q347 326 329 335 C350 327 359 340 346 353 C330 370 296 373 297 352 L305 349",
        "M369 295 C357 290 359 305 364 319 Q369 337 357 347",
        "M354 335 C371 338 394 338 401 329 Q405 322 398 323",
        "M422 285 C408 278 395 284 402 295 C408 305 425 301 431 309 C441 322 424 328 413 320",
        "M450 307 L455 307",
        "M476 293 L469 263 L479 255",
        "M464 270 L494 279",
        "M491 278 L477 282 L499 296",
      ] },
      { duration: 420, width: 12, paths: [
        "M2 497 L825 174",
        "M792 176 L823 174 L795 193",
        "M180 430 Q333 367 505 339",
      ] },
    ];
    const group = figure.querySelector("#storySketchStrokes");
    let phaseStart = 0;
    for (const phase of phases) {
      const paths = phase.paths.map((description) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", description);
        path.setAttribute("pathLength", "1");
        path.setAttribute("stroke-width", String(phase.width));
        group.append(path);
        return path;
      });
      const lengths = paths.map((path) => path.getTotalLength());
      const totalLength = lengths.reduce((sum, length) => sum + length, 0);
      let traversed = 0;
      for (const [index, path] of paths.entries()) {
        const start = phaseStart + Math.round(phase.duration * traversed / totalLength);
        traversed += lengths[index];
        const end = phaseStart + Math.round(phase.duration * traversed / totalLength);
        animations.push(path.animate([
          { strokeDashoffset: 1, opacity: 0 },
          { strokeDashoffset: 1, opacity: 1, offset: 0.001 },
          { strokeDashoffset: 0, opacity: 1 },
        ], {
          delay: start, duration: end - start, easing: "linear", fill: "both",
        }));
      }
      phaseStart += phase.duration;
    }
    animations.push(figure.querySelector(".sketch-original").animate([{ opacity: 0 }, { opacity: 1 }], {
      delay: 4800, duration: 200, easing: "linear", fill: "both",
    }));
    const startTime = document.timeline.currentTime;
    for (const animation of animations) animation.startTime = startTime;
    figure.dataset.sketchState = "drawing";
    await Promise.all(animations.map((animation) => animation.finished));
    complete();
  } catch {
    complete();
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function storyImage(story, className) {
  const image = element("img", className);
  image.src = story.thumb;
  image.alt = `${story.title}的官方图文配图`;
  image.loading = "lazy";
  return image;
}

function imageLink(story) {
  const link = element("a", "story-image-link");
  link.href = story.image;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = "查看原图";
  link.setAttribute("aria-label", `查看《${story.title}》配图原图`);
  link.append(storyImage(story, ""));
  return link;
}

function sourceLabel(story) {
  if (!story.date) return "官方画册 · 跨年作品线索";
  return story.hasOriginalTitle
    ? `官方图文《${story.title}》 · ${story.date}`
    : `官方图文 · ${story.date}（编辑主题）`;
}

function sourceButton(story) {
  const button = element("button", "story-source-button", "查看原文");
  button.type = "button";
  button.dataset.storyKey = story.key;
  return button;
}

function renderFeatures() {
  const fragment = document.createDocumentFragment();
  for (const feature of featured) {
    const story = stories.find((candidate) => candidate.id === feature.id);
    if (!story) throw new Error(`Missing featured story: ${feature.id}`);
    const article = element("article", "story-feature");
    const figure = element("figure", "story-feature-image");
    figure.append(imageLink(story));
    const copy = element("div", "story-feature-copy");
    copy.append(
      element("span", "story-feature-meta", story.date || story.year),
      element("h3", "", feature.title),
      element("p", "", feature.description),
      element("small", "", sourceLabel(story)),
    );
    copy.append(sourceButton(story));
    article.append(figure, copy);
    fragment.append(article);
  }
  els.features.replaceChildren(fragment);
}

function renderYearFilter() {
  const labels = [["all", "全部"], ["2021", "2021"], ["2022", "2022"], ["2023", "2023"], ["2024—2026", "2024—2026"]];
  const fragment = document.createDocumentFragment();
  for (const [value, label] of labels) {
    const button = element("button", "story-year-button", label);
    button.type = "button";
    button.dataset.year = value;
    fragment.append(button);
  }
  els.yearFilter.replaceChildren(fragment);
}

function renderEntry(story) {
  const article = element("article", "story-entry");
  const media = element("div", "story-entry-media");
  media.append(imageLink(story));
  const copy = element("div", "story-entry-copy");
  copy.append(
    element("span", "story-entry-meta", `${story.date || story.year} · ${story.kind}`),
    element("h3", "", story.title),
  );
  if (story.topic && story.topic !== story.title) copy.append(element("span", "story-entry-topic", story.topic));
  copy.append(element("p", "story-entry-summary", story.summary));
  if (story.quote) copy.append(element("blockquote", "story-entry-quote", `“${story.quote}”`));
  copy.append(element("small", "story-entry-source", sourceLabel(story)));
  copy.append(sourceButton(story));
  article.append(media, copy);
  return article;
}

function openSource(story) {
  els.sourceTitle.textContent = story.title;
  els.sourceNote.textContent = story.date
    ? `${story.date} · 原始图文文字，可能包含发售说明与作品清单。`
    : "跨年主题所引代表作品的原始图文文字；各作品并非同一篇文章。";
  const fragment = document.createDocumentFragment();
  for (const section of story.sourceSections) {
    const article = element("section", "story-source-section");
    const copy = element("div", "reading-copy");
    copy.innerHTML = window.BelongsReading.format(section.text, { id: story.id }).html;
    article.append(element("h3", "", section.label), copy);
    fragment.append(article);
  }
  els.sourceBody.replaceChildren(fragment);
  els.dialog.showModal();
}

function matches(story) {
  const yearMatches = state.year === "all" || story.year === state.year;
  const text = [story.title, story.topic, story.summary, story.quote, story.kind, story.date, story.year].join(" ").toLowerCase();
  return yearMatches && text.includes(state.query);
}

function renderCatalog() {
  const filtered = stories.filter(matches);
  const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * state.pageSize;
  const fragment = document.createDocumentFragment();
  for (const story of filtered.slice(start, start + state.pageSize)) fragment.append(renderEntry(story));
  els.catalog.replaceChildren(fragment);
  els.count.textContent = `共 ${filtered.length} 条线索`;
  els.empty.hidden = filtered.length > 0;
  els.pageInfo.textContent = `第 ${state.page} / ${pages} 页`;
  els.previous.disabled = state.page <= 1;
  els.next.disabled = state.page >= pages;
  for (const button of els.yearFilter.querySelectorAll("button")) {
    const active = button.dataset.year === state.year;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

els.yearFilter.addEventListener("click", (event) => {
  const button = event.target.closest("[data-year]");
  if (!button) return;
  state.year = button.dataset.year;
  state.page = 1;
  renderCatalog();
});

els.search.addEventListener("input", () => {
  state.query = els.search.value.trim().toLowerCase();
  state.page = 1;
  renderCatalog();
});

els.previous.addEventListener("click", () => {
  state.page -= 1;
  renderCatalog();
  document.querySelector("#story-catalog").scrollIntoView({ block: "start" });
});

els.next.addEventListener("click", () => {
  state.page += 1;
  renderCatalog();
  document.querySelector("#story-catalog").scrollIntoView({ block: "start" });
});

for (const container of [els.features, els.catalog]) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-story-key]");
    if (!button) return;
    const story = stories.find((candidate) => candidate.key === button.dataset.storyKey);
    if (story) openSource(story);
  });
}

els.sourceClose.addEventListener("click", () => els.dialog.close());
els.dialog.addEventListener("click", (event) => {
  if (event.target === els.dialog) els.dialog.close();
});

setupIllustrationVoices();
setupStorySketch();
renderFeatures();
renderYearFilter();
renderCatalog();
