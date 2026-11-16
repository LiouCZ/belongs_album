(function () {
  const opening = document.querySelector(".philosophy-opening");
  const portrait = document.querySelector(".brand-illustration");
  const sketch = document.querySelector(".story-sketch");
  const introduction = document.querySelector(".philosophy-introduction");
  const hosts = [...document.querySelectorAll(".story-ornament")];
  if (!opening || !portrait || !sketch || !introduction || hosts.length !== 2) return;
  const canvases = hosts.map((host) => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);
    return canvas;
  });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function curve(start, segments) {
    const points = [{ ...start, distance: 0 }];
    let from = start;
    for (const [a, b, end] of segments) {
      for (let step = 1; step <= 80; step += 1) {
        const t = step / 80;
        const u = 1 - t;
        const x = u ** 3 * from.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * end.x;
        const y = u ** 3 * from.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * end.y;
        const previous = points[points.length - 1];
        points.push({ x, y, distance: previous.distance + Math.hypot(x - previous.x, y - previous.y) });
      }
      from = end;
    }
    return { points, length: points[points.length - 1].distance };
  }

  function pointAt(path, distance) {
    const points = path.points;
    let low = 1;
    let high = points.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (points[middle].distance < distance) low = middle + 1;
      else high = middle;
    }
    const a = points[low - 1];
    const b = points[low];
    const length = b.distance - a.distance || 1;
    const t = clamp((distance - a.distance) / length, 0, 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx: (b.x - a.x) / length, ty: (b.y - a.y) / length };
  }

  function drawBones(context, image, path, width, progress) {
    const unitWidth = width * image.width / image.height;
    const count = Math.max(2, Math.floor((path.length - unitWidth) / (unitWidth * 0.83)) + 1);
    const spacing = (path.length - unitWidth) / (count - 1);
    // Keep the photographed hooks intact; rotate whole units along the spine.
    for (let index = 0; index < count; index += 1) {
      const reveal = clamp(progress * count - index, 0, 1);
      if (!reveal) break;
      const distance = unitWidth / 2 + index * spacing;
      const point = pointAt(path, distance);
      context.save();
      context.globalAlpha = reveal;
      context.translate(point.x, point.y);
      context.rotate(Math.atan2(point.ty, point.tx));
      context.drawImage(image, -unitWidth / 2, -width / 2, unitWidth, width);
      context.restore();
    }
  }

  function stem(context, path, width = 1, progress = 1) {
    if (progress <= 0) return;
    const distance = path.length * clamp(progress, 0, 1);
    const end = pointAt(path, distance);
    context.beginPath();
    context.moveTo(path.points[0].x, path.points[0].y);
    for (const point of path.points.slice(1)) {
      if (point.distance >= distance) break;
      context.lineTo(point.x, point.y);
    }
    context.lineTo(end.x, end.y);
    context.strokeStyle = "rgba(177, 199, 159, 0.76)";
    context.lineWidth = width;
    context.lineCap = "round";
    context.stroke();
  }

  function drawLeaf(context, size, progress) {
    if (progress <= 0) return;
    const growth = progress * progress * (3 - 2 * progress);
    context.save();
    context.globalAlpha = growth;
    context.rotate((1 - growth) * -0.2);
    context.scale(0.12 + growth * 0.88, 0.5 + growth * 0.5);
    const lobes = [
      [-0.05, -0.02, -0.1, 0.18, -0.27, 0.14],
      [-0.39, 0.14, -0.57, 0.04, -0.6, -0.1],
      [-0.73, -0.11, -0.8, -0.19, -0.78, -0.27],
      [-0.74, -0.34, -0.61, -0.37, -0.57, -0.4],
      [-0.67, -0.46, -0.72, -0.63, -0.66, -0.72],
      [-0.52, -0.74, -0.39, -0.65, -0.32, -0.64],
      [-0.25, -0.88, -0.12, -1, 0.015, -1.09],
      [0.16, -0.98, 0.29, -0.88, 0.33, -0.68],
      [0.45, -0.72, 0.59, -0.8, 0.67, -0.71],
      [0.73, -0.62, 0.69, -0.47, 0.6, -0.42],
      [0.77, -0.4, 0.83, -0.3, 0.81, -0.2],
      [0.77, -0.07, 0.61, -0.04, 0.54, 0.04],
      [0.45, 0.15, 0.3, 0.19, 0.2, 0.13],
      [0.09, 0.15, 0.07, -0.04, 0, 0],
    ];
    const blade = curve({ x: 0, y: 0 }, lobes.map((segment) => [
      { x: segment[0] * size, y: segment[1] * size },
      { x: segment[2] * size, y: segment[3] * size },
      { x: segment[4] * size, y: segment[5] * size },
    ]));
    context.beginPath();
    context.moveTo(0, 0);
    // Fine teeth follow a full five-lobed blade, leaving the petiole notch smooth.
    for (let step = 1; step <= 64; step += 1) {
      const point = pointAt(blade, blade.length * step / 64);
      const tooth = step > 4 && step < 60 && step % 2 ? size * (0.025 + Math.sin(step * 2.3) * 0.006) : 0;
      context.lineTo(point.x + point.ty * tooth, point.y - point.tx * tooth);
    }
    context.closePath();
    const wash = context.createLinearGradient(-size * 0.65, -size * 0.25, size * 0.55, -size * 0.95);
    wash.addColorStop(0, "rgba(158, 185, 144, 0.07)");
    wash.addColorStop(0.48, "rgba(158, 185, 144, 0.28)");
    wash.addColorStop(1, "rgba(186, 205, 170, 0.09)");
    context.fillStyle = wash;
    context.fill();
    context.strokeStyle = "rgba(186, 205, 170, 0.85)";
    context.lineWidth = 0.9;
    context.stroke();

    // Five main veins radiate from the petiole without crowding the leaf surface.
    const folds = [
      [[0, -0.01], [-0.04, -0.37, 0.06, -0.75, 0.015, -1]],
      [[-0.015, -0.025], [-0.18, -0.29, -0.35, -0.53, -0.6, -0.67]],
      [[-0.025, -0.02], [-0.26, -0.14, -0.49, -0.2, -0.7, -0.24]],
      [[0.012, -0.025], [0.21, -0.28, 0.42, -0.56, 0.63, -0.66]],
      [[0.025, -0.018], [0.26, -0.1, 0.56, -0.13, 0.72, -0.24]],
    ];
    for (const [index, [start, segment]] of folds.entries()) {
      const reveal = clamp((growth - 0.28 - index * 0.035) / 0.4, 0, 1);
      const fold = curve({ x: start[0] * size, y: start[1] * size }, [[
        { x: segment[0] * size, y: segment[1] * size },
        { x: segment[2] * size, y: segment[3] * size },
        { x: segment[4] * size, y: segment[5] * size },
      ]]);
      stem(context, fold, index === 0 ? 0.85 : 0.65, reveal);
    }
    context.restore();
  }

  function drawVine(context, path, size, portraitBottom, portraitRight, desktop, progress) {
    stem(context, path, 1, progress / 0.8);
    const positions = desktop ? [0.12, 0.38, 0.65, 0.91] : [0.17, 0.49, 0.81];
    for (const [index, fraction] of positions.entries()) {
      const reveal = clamp((progress - fraction * 0.8) / 0.18, 0, 1);
      if (!reveal) continue;
      const point = pointAt(path, path.length * fraction);
      const side = index % 2 ? -1 : 1;
      const normal = { x: point.ty * side, y: -point.tx * side };
      let height = size * [0.9, 1.12, 0.88, 1.02][index % 4];
      if (point.y > portraitBottom) height = Math.min(height, 28);
      const branch = height * (desktop ? 0.53 : 0.35);
      const lean = height * [0.4, -0.28, 0.36, -0.2][index % 4];
      const attach = {
        x: point.x + normal.x * branch + point.tx * lean,
        y: point.y + normal.y * branch + point.ty * lean,
      };
      if (desktop) {
        const clearance = height * 1.2 + 14;
        if (point.y > portraitBottom) attach.y = Math.max(attach.y, portraitBottom + clearance);
        else attach.x = Math.max(attach.x, portraitRight + clearance);
      }
      stem(context, curve(point, [[
        { x: point.x + normal.x * branch * 0.12 + point.tx * lean, y: point.y + normal.y * branch * 0.12 + point.ty * lean },
        { x: attach.x - point.tx * height * 0.25, y: attach.y - point.ty * height * 0.25 }, attach,
      ]]), 0.8, reveal * 2);
      context.save();
      context.translate(attach.x, attach.y);
      context.rotate(Math.atan2(normal.y, normal.x) + Math.PI / 2 + [-0.3, 0.34, -0.2, 0.24][index % 4]);
      drawLeaf(context, height, clamp((reveal - 0.15) / 0.85, 0, 1));
      context.restore();
    }
    for (const [index, fraction] of [0.23, 0.49, 0.73, 0.95].entries()) {
      const reveal = clamp((progress - fraction * 0.8) / 0.15, 0, 1);
      if (!reveal) continue;
      const point = pointAt(path, path.length * fraction);
      const side = index % 2 ? -1 : 1;
      const normal = { x: point.ty * side, y: -point.tx * side };
      const radius = size * 0.32;
      const reach = radius * 1.6;
      const center = { x: point.x + normal.x * reach, y: point.y + normal.y * reach };
      if (desktop && point.y > portraitBottom) center.y = Math.max(center.y, portraitBottom + radius + 14);
      const start = { x: center.x + point.tx * radius, y: center.y + point.ty * radius };
      const curl = curve(point, [[
        { x: point.x + point.tx * radius, y: point.y + point.ty * radius },
        { x: start.x - normal.x * radius, y: start.y - normal.y * radius }, start,
      ]]);
      for (let angle = 0.1; angle <= Math.PI * 2.2; angle += 0.1) {
        const r = radius * (1 - angle / (Math.PI * 2.8));
        const x = center.x + point.tx * Math.cos(angle) * r + normal.x * Math.sin(angle) * r;
        const y = center.y + point.ty * Math.cos(angle) * r + normal.y * Math.sin(angle) * r;
        const previous = curl.points[curl.points.length - 1];
        curl.length += Math.hypot(x - previous.x, y - previous.y);
        curl.points.push({ x, y, distance: curl.length });
      }
      stem(context, curl, 0.75, reveal);
    }
  }

  function prepare(index, anchor, top, bottom, width) {
    const host = hosts[index];
    const canvas = canvases[index];
    const height = Math.max(1, bottom - top);
    Object.assign(host.style, { left: `${-anchor.x}px`, top: `${top - anchor.y}px`, width: `${width}px`, height: `${height}px` });
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8000000 / (width * height)));
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.scale(ratio, ratio);
    context.imageSmoothingQuality = "high";
    const protectedAreas = [sketch, introduction, portrait].map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x - 12, y: box.y - top - 12, width: box.width + 24, height: box.height + 24 };
    });
    return { context, top, width, height, protectedAreas };
  }

  function clearContent(scene) {
    const { context, protectedAreas } = scene;
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "black";
    for (const box of protectedAreas) {
      context.fillRect(box.x, box.y, box.width, box.height);
    }
    context.restore();
  }

  async function load(name) {
    const image = new Image();
    image.src = `assets/brand-story/${name}-cutout.png`;
    await image.decode();
    return image;
  }

  async function initialize() {
    const bone = await load("snake-bone");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const models = hosts.map((host) => ({ host, progress: 0, elapsed: 0, lastTime: null, visible: false }));
    let frame = 0;
    let layoutFrame = 0;

    function paint(model) {
      const { scene, path, progress } = model;
      scene.context.clearRect(0, 0, scene.width, scene.height);
      if (model === models[0]) drawBones(scene.context, bone, path, model.size, progress);
      else drawVine(scene.context, path, model.size, model.portraitBottom, model.portraitRight, model.desktop, progress);
      clearContent(scene);
    }

    function render() {
      layoutFrame = 0;
      const width = document.documentElement.clientWidth;
      const openingBox = opening.getBoundingClientRect();
      const imageBox = sketch.getBoundingClientRect();
      const portraitBox = portrait.getBoundingClientRect();
      const introBox = introduction.getBoundingClientRect();
      const desktop = width >= 1024;
      const boneScene = prepare(0, openingBox, desktop ? imageBox.y - 16 : introBox.bottom + 12, portraitBox.y - 12, width);
      const vineScene = prepare(1, portraitBox, desktop ? imageBox.y + 72 : portraitBox.bottom + 12, portraitBox.bottom + 100, width);
      let bonePath;
      let vinePath;
      let boneWidth;
      let leafSize;
      if (desktop) {
        const left = imageBox.x;
        const gap = Math.min(left - 12, 310);
        const h = boneScene.height;
        boneWidth = clamp(gap * 0.2, 24, 50);
        bonePath = curve({ x: left - gap * 0.42, y: boneWidth / 2 + 12 }, [
          [{ x: left - gap * 0.9, y: h * 0.18 }, { x: left - gap * 0.08, y: h * 0.3 }, { x: left - gap * 0.46, y: h * 0.48 }],
          [{ x: left - gap * 0.88, y: h * 0.7 }, { x: left - gap * 0.78, y: h - 92 }, { x: left - gap * 0.35, y: h - 55 }],
          [{ x: left + 70, y: h - 20 }, { x: left + 260, y: h - 70 }, { x: left + 440, y: h - 36 }],
        ]);
        const right = portraitBox.right;
        const space = Math.min(width - right - 12, 310);
        const figureTop = portraitBox.y - vineScene.top;
        const figureBottom = portraitBox.bottom - vineScene.top;
        vinePath = curve({ x: right + space * 0.55, y: 16 }, [
          [{ x: right + space * 0.9, y: 140 }, { x: right + space * 0.08, y: figureTop - 160 }, { x: right + space * 0.55, y: figureTop + 65 }],
          [{ x: right + space * 0.9, y: figureTop + 190 }, { x: right + space * 0.68, y: figureBottom + 70 }, { x: right + space * 0.14, y: figureBottom + 58 }],
          [{ x: right - 70, y: figureBottom + 15 }, { x: right - 250, y: figureBottom + 78 }, { x: right - 420, y: figureBottom + 45 }],
        ]);
        leafSize = clamp(space * 0.25, 24, 58);
      } else {
        const h = boneScene.height;
        bonePath = curve({ x: 24, y: h * 0.65 }, [[{ x: width * 0.34, y: -2 }, { x: width * 0.65, y: h + 8 }, { x: width - 24, y: h * 0.38 }]]);
        const v = vineScene.height;
        vinePath = curve({ x: 24, y: v * 0.67 }, [[{ x: width * 0.3, y: v * 0.44 }, { x: width * 0.75, y: v * 0.38 }, { x: width - 24, y: v * 0.68 }]]);
        boneWidth = width < 500 ? 23 : 29;
        leafSize = width < 500 ? 28 : 32;
      }
      Object.assign(models[0], { scene: boneScene, path: bonePath, size: boneWidth });
      Object.assign(models[1], {
        scene: vineScene, path: vinePath, size: leafSize, desktop,
        portraitBottom: portraitBox.bottom - vineScene.top,
        portraitRight: portraitBox.right,
      });
      for (const model of models) {
        paint(model);
        model.host.dataset.ornamentState = "ready";
      }
    }

    function schedule() {
      if (!layoutFrame) layoutFrame = requestAnimationFrame(render);
    }

    function scheduleGrowth() {
      if (!frame && !document.hidden && models.some((model) => model.visible && model.progress < 1)) {
        frame = requestAnimationFrame(grow);
      }
    }

    function grow(now) {
      frame = 0;
      for (const model of models) {
        if (!model.visible || model.progress === 1) continue;
        if (model.lastTime === null) model.lastTime = now;
        // Limit large decorative canvases to 30fps; stop scheduling after completion.
        if (now - model.lastTime < 32) continue;
        model.elapsed += now - model.lastTime;
        model.lastTime = now;
        model.progress = clamp(model.elapsed / 5000, 0, 1);
        paint(model);
        if (model.progress === 1) model.host.dataset.growthState = "complete";
      }
      scheduleGrowth();
    }

    let visibility;
    function finish() {
      cancelAnimationFrame(frame);
      frame = 0;
      visibility?.disconnect();
      for (const model of models) {
        model.progress = 1;
        model.elapsed = 5000;
        model.lastTime = null;
        model.host.dataset.growthState = "complete";
        paint(model);
      }
    }

    models.forEach((model) => { model.host.dataset.growthState = "waiting"; });
    render();
    if (motion.matches || !window.IntersectionObserver) finish();
    else {
      visibility = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const model = models.find((candidate) => candidate.host === entry.target);
          model.visible = entry.isIntersecting;
          model.lastTime = null;
          if (model.visible && model.progress < 1) model.host.dataset.growthState = "growing";
        }
        scheduleGrowth();
      });
      models.forEach((model) => visibility.observe(model.host));
    }
    motion.addEventListener("change", (event) => { if (event.matches) finish(); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        models.forEach((model) => { model.lastTime = null; });
      } else scheduleGrowth();
    });
    window.addEventListener("resize", schedule, { passive: true });
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(schedule);
      observer.observe(opening);
      observer.observe(portrait);
    }
    document.fonts?.ready.then(schedule);
  }
  initialize().catch(() => hosts.forEach((host) => { host.dataset.ornamentState = "unavailable"; }));
})();
