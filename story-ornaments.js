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

  function drawBones(context, image, path, width) {
    const unitWidth = width * image.width / image.height;
    const count = Math.max(2, Math.floor((path.length - unitWidth) / (unitWidth * 0.83)) + 1);
    const spacing = (path.length - unitWidth) / (count - 1);
    // Keep the photographed hooks intact; rotate whole units along the spine.
    for (let index = 0; index < count; index += 1) {
      const distance = unitWidth / 2 + index * spacing;
      const point = pointAt(path, distance);
      context.save();
      context.translate(point.x, point.y);
      context.rotate(Math.atan2(point.ty, point.tx));
      context.drawImage(image, -unitWidth / 2, -width / 2, unitWidth, width);
      context.restore();
    }
  }

  function stem(context, points, width = 1.2) {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.strokeStyle = "rgba(29, 59, 37, 0.45)";
    context.lineWidth = width + 1;
    context.stroke();
    context.strokeStyle = "rgba(148, 181, 111, 0.9)";
    context.lineWidth = width;
    context.lineCap = "round";
    context.stroke();
  }

  function drawVine(context, image, path, size, portraitBottom) {
    stem(context, path.points);
    const positions = [0.035, 0.112, 0.204, 0.296, 0.385, 0.477, 0.576, 0.665, 0.757, 0.842, 0.913, 0.973];
    for (const [index, fraction] of positions.entries()) {
      const point = pointAt(path, path.length * fraction);
      const side = index % 2 ? -1 : 1;
      const normal = { x: point.ty * side, y: -point.tx * side };
      let height = size * [0.85, 1.08, 0.93, 1.16, 0.82][index % 5];
      if (point.y > portraitBottom) height = Math.min(height, 34);
      const branch = height * 0.24;
      const attach = { x: point.x + normal.x * branch, y: point.y + normal.y * branch };
      stem(context, curve(point, [[{ x: point.x + normal.x * branch * 0.7, y: point.y + normal.y * branch * 0.7 }, { x: attach.x - point.tx * 5, y: attach.y - point.ty * 5 }, attach]]).points, 0.9);
      context.save();
      context.translate(attach.x, attach.y);
      context.rotate(Math.atan2(normal.y, normal.x) - Math.PI / 2 + (index % 3 - 1) * 0.24);
      const width = height * image.width / image.height;
      context.drawImage(image, -width * 0.45, -height * 0.07, width, height);
      context.restore();
      if (index % 3 === 1) {
        const radius = height * 0.24;
        const center = { x: point.x - normal.x * radius * 1.3, y: point.y - normal.y * radius * 1.3 };
        const curl = [point];
        for (let t = 0; t < Math.PI * 2.3; t += 0.1) {
          const r = radius * (1 - t / (Math.PI * 2.3));
          curl.push({ x: center.x + Math.cos(t) * r, y: center.y + Math.sin(t) * r });
        }
        stem(context, curl, 0.75);
      }
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
    return { context, top, height };
  }

  function clearContent(scene) {
    const { context, top } = scene;
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "black";
    for (const element of [sketch, introduction, portrait]) {
      const box = element.getBoundingClientRect();
      context.fillRect(box.x - 12, box.y - top - 12, box.width + 24, box.height + 24);
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
    const leaf = await load("grape-leaf");
    const bone = await load("snake-bone");
    let frame = 0;
    function render() {
      frame = 0;
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
        leafSize = clamp(space * 0.23, 24, 72);
      } else {
        const h = boneScene.height;
        bonePath = curve({ x: 24, y: h * 0.65 }, [[{ x: width * 0.34, y: -2 }, { x: width * 0.65, y: h + 8 }, { x: width - 24, y: h * 0.38 }]]);
        const v = vineScene.height;
        vinePath = curve({ x: 24, y: v * 0.6 }, [[{ x: width * 0.3, y: 5 }, { x: width * 0.75, y: v * 0.85 }, { x: width - 24, y: v * 0.3 }]]);
        boneWidth = width < 500 ? 23 : 29;
        leafSize = width < 500 ? 23 : 32;
      }
      drawBones(boneScene.context, bone, bonePath, boneWidth);
      drawVine(vineScene.context, leaf, vinePath, leafSize, portraitBox.bottom - vineScene.top);
      clearContent(boneScene);
      clearContent(vineScene);
      hosts.forEach((host) => { host.dataset.ornamentState = "ready"; });
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(render);
    }
    render();
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
