(() => {
  // These anchors describe layout only. A changed source falls back to the general rules.
  const special = {
    "2021-031-0ae3e86147": { headings: ["羽翼（左/右）", "银饼", "古币饼", "熔币饼", "平打戒指", "平打手镯", "B字戒", "莫比乌斯镯", "贝羽", "小羽", "配饰", "作品欣赏"] },
    "2021-098-946559c67e": { headings: ["熔币饼3"] },
    "2021-122-83ea808aad": { headings: ["熔币银鹰盾"] },
    "2021-129-1496fed766": { headings: ["特别版贝羽"] },
    "2021-173-24c8bda878": { headings: ["金桶珠（1对）"] },
    "2021-225-3d46972a33": { headings: ["十字架L", "十字架S", "银牌", "平打宽戒", "B戒"] },
    "2021-227-ec31f98419": { headings: ["特别版熔币饼"] },
    "2021-234-6cb51860ff": { headings: ["平打宽戒", "银牌1"] },
    "2021-256-d36d5e6cf0": { headings: ["蛇元素特别套装："] },
    "2021-266-98139d877c": { headings: ["鹰点金配饰小银牌", "鹰点金配饰小金牌"] },
    "2022-067-310f0b46de": { paragraphEnds: [
      "好像大家也习惯于这样的节奏，不求长久，只争朝夕。",
      "对艺术的追求，对信仰的执着，再到日常的琐碎，都会牢牢占据人生的光阴。",
      "同样，文化也不应该因此而变得肤浅。",
      "就像朝圣的信徒，就像耕作的农夫，太多的风雨无阻，太多的任劳任怨，中国人从来不缺乏这样的坚守与毅力。",
      "希望大家走过人生的万里路时，身旁一直有Belongs的作品长久相伴、无言见证。",
    ] },
    "2022-068-bedc317626": { paragraphEnds: [
      "它就像一粒种子，包裹着善良与美好，长出清冽甘甜的果实。",
      "而初心，就是出发的理由，就像茫茫黑夜中远方照来的一束光，为我们指引方向。",
      "它像我们每一个个体，在时代的洪流中奔走、拥抱、告别、相忘于山川湖海，或遗失在街边巷角，最终完成各自的漂流之旅。",
      "它无关炫酷、无关时尚、无关潮流、甚至带着些许朴素，但却是我们心境的真实写照。",
      "愿我们在这段漂流之旅中，永不忘却它。",
    ] },
    "2022-076-84d2a25610": { verseBefore: "说明：" },
    "2022-094-71900f468f": { verse: true, check: ["止不住 ，随它流 。"] },
    "2023-002-733543a278": { verseBefore: "说明：" },
    "2023-008-8d9e14725b": { verseBefore: "说明：" },
    "2023-013-361b50f596": { verseBefore: "说明：" },
    "2024-026-a976d3e338": { openTitle: "搭配：0.4*60cm圆十字光主题OT链）" },
    "2024-083-cb292cc583": { headings: ["*发售内容："] },
    "2026-017-9f1a80038b": { inlineType: {
      text: "已固定造型独立雕刻鹰首 符节 反战 羽翼", type: "已固定造型独立雕刻",
    } },
    "2026-061-f39b5c1582": { headings: ["*儿童节钥匙"], continuations: {
      "*元素：鎏金葡萄叶&鎏金茛苕.花、": "六一字样、金沙漏。",
    } },
    "2026-070-3846e976f6": { elements: ["金沙漏 金眼 茛苕 BK字母 2026"] },
    "2026-071-d5a8fb7bd6": { elements: ["金沙漏 金眼 鹿角蕨 并肩马 2026"] },
    "2026-073-891185d29f": { elements: ["金沙漏 飞羽鹰首 2026"] },
  };
  const escape = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const anchors = Object.fromEntries(Object.entries(special).map(([id, rule]) =>
    [id, [...(rule.headings || []), ...(rule.paragraphEnds || []), ...(rule.verseBefore ? [rule.verseBefore] : []),
      ...(rule.check || []), ...(rule.openTitle ? [rule.openTitle] : []), ...(rule.elements || []),
      ...(rule.inlineType ? [rule.inlineType.text] : []), ...Object.entries(rule.continuations || {}).flat()]]));

  function title(value, { id = "", caption = "" } = {}) {
    const raw = String(value || "");
    const match = raw.match(/^\s*\d{1,2}\s*[.．、]\s*[^（(\n]{1,28}([（(])/);
    if (!match) return { heading: raw, description: "" };
    const start = match[0].length - 1;
    const rest = raw.slice(start);
    const rule = special[id.replace(/^legacy:/, "")];
    if (rule?.openTitle && caption.split(/\r?\n/)[0] === rule.openTitle) {
      return { heading: raw.slice(0, start), description: rest };
    }
    const stack = [];
    for (let index = 0; index < rest.length; index += 1) {
      const char = rest[index];
      if (char === "（" || char === "(") stack.push(char);
      if (char === "）" || char === ")") {
        if (stack.pop() !== (char === "）" ? "（" : "(")) return { heading: raw, description: "" };
        if (!stack.length && rest.slice(index + 1).trim()) return { heading: raw, description: "" };
      }
    }
    if (stack.length || (rest.length < 18 && !/[。！？；：]/.test(rest))) return { heading: raw, description: "" };
    return { heading: raw.slice(0, start), description: rest };
  }

  function headingHtml(value) {
    const match = String(value).match(/^(\s*\d{1,2}\s*[.．、]\s*)([^\d][\s\S]*)$/);
    return match ? `<span class="reading-title-number">${escape(match[1])}</span>${escape(match[2])}` : escape(value);
  }

  const heading = /^(?:[●•]\s*)?(?:本期内容|本期作品|本批作品|作品内容|作品说明|说明|购买方式)[：:]?$/;
  const numbering = /^([ \t]*(?:[❶-❿①-⑳]|\d{1,2}\s*(?:->|→|[–—*]|-(?!\d)|[.．、](?!\d)))[ \t]*)(.+)$/;
  const signature = /^\s*[—–-]{2,}\s*BELONGS\b.*[—–-]{2,}\s*$/i;
  const field = /^([ \t]*[*＊]?[ \t]*)(搭配|规格|材质|尺寸|尺码|参考重量|重量|克重|长度|宽度|直径|制作类型|类型|元素|数量|备注)([：:][ \t]*)(.+)$/;
  const making = /^(?:固定品类|即兴|(?:已|非|不)?固定造型[ \t]*(?:独立)?(?:雕刻|錾刻)|随机造型独立雕刻|宽度厚度近似、独立制作雕刻)$/;

  function format(value, { id = "", theme = "", trustedSpecs = false } = {}) {
    const raw = String(value || "");
    const suffix = theme && raw.endsWith(`\n\n${theme}`) ? `\n\n${theme}` : "";
    const body = suffix ? raw.slice(0, -suffix.length) : raw;
    const parts = body.split(/(\r\n|\n|\r)/);
    const lines = [];
    for (let index = 0; index < parts.length; index += 2) {
      if (parts[index] || parts[index + 1]) lines.push({ text: parts[index], after: parts[index + 1] || "" });
    }
    const key = id.replace(/^legacy:/, "");
    const rule = special[key] && anchors[key].every((anchor) => lines.filter((line) => line.text === anchor).length === 1) ? special[key] : {};
    if (rule.inlineType) {
      const index = lines.findIndex((line) => line.text === rule.inlineType.text);
      const line = lines[index];
      lines.splice(index, 1, { text: rule.inlineType.type, after: "" },
        { text: line.text.slice(rule.inlineType.type.length), after: line.after });
    }
    const inferred = new Map();
    const verifiedSpecs = new Set();
    // Infer bare fields only inside the verified type / elements / specification structure.
    for (let index = 0; index < lines.length; index += 1) {
      if (!making.test(lines[index].text)) continue;
      let end = index + 1;
      while (end < lines.length && end <= index + 3 && lines[end].text.trim()
        && lines[end].text.length <= 160 && !/[。！？；：:]/.test(lines[end].text)
        && !heading.test(lines[end].text) && !numbering.test(lines[end].text) && !signature.test(lines[end].text)) end += 1;
      const labels = lines.slice(end, end + 3).map((line) => line.text.match(field)?.[2]);
      if (end === index + 1 || labels.join("|") !== "搭配|规格|材质") continue;
      inferred.set(index, { label: "制作类型", content: lines[index].text, count: 1, derived: true });
      const elements = lines.slice(index + 1, end);
      inferred.set(index + 1, { label: "元素", content: elements.map((line, offset) =>
        line.text + (offset < elements.length - 1 ? line.after : "")).join(""), count: elements.length, derived: true });
      for (let offset = 0; offset < 3; offset += 1) verifiedSpecs.add(end + offset);
    }
    for (const element of rule.elements || []) {
      const index = lines.findIndex((line) => line.text === element);
      inferred.set(index, { label: "元素", content: element, count: 1, derived: true });
    }
    const specification = (index) => {
      if (inferred.has(index)) return inferred.get(index);
      const found = lines[index]?.text.match(field);
      if (!found) return null;
      const [, prefix, label, colon, content] = found;
      const explicit = prefix.includes("*") || prefix.includes("＊");
      const factual = /(?:\d|配方|纯银|黄金|白银|古币|银币|皮绳|标准|^Mini$|^[SMLX]+$)/i.test(content) && !/[。！？]/.test(content);
      return trustedSpecs || verifiedSpecs.has(index) || explicit || factual || (label === "制作类型" && making.test(content))
        ? { prefix, label, colon, content, count: 1 } : null;
    };
    const sectionNames = new Set(rule.headings || []);
    const ends = new Set(rule.paragraphEnds || []);
    const verseEnd = rule.verseBefore ? lines.findIndex((line) => line.text === rule.verseBefore) : -1;
    const autoVerse = rule.verse || (lines.length >= 4 && lines.length <= 12 && body.length < 350
      && lines.some((line) => signature.test(line.text))
      && !lines.some((line) => field.test(line.text) || numbering.test(line.text) || heading.test(line.text)));
    const compact = body.length < 240 && lines.length > 1 && !lines.some((line) =>
      heading.test(line.text) || numbering.test(line.text) || sectionNames.has(line.text) || signature.test(line.text));
    const paragraphOnBlank = /\r?\n[ \t]*\r?\n/.test(body);
    const output = [];
    let pending = [];
    let note = false;
    let openParentheses = 0;
    const balance = (text) => [...text].reduce((value, char) => value + ("（(".includes(char) ? 1 : "）)".includes(char) ? -1 : 0), 0);
    const flush = () => {
      if (!pending.length) return;
      const last = pending.at(-1);
      const text = pending.map((line, index) => line.text + (index === pending.length - 1 ? "" : line.after)).join("");
      output.push(`<p class="detail-paragraph reading-paragraph${compact ? " reading-description" : ""}${note ? " reading-note" : ""}">${escape(text)}</p>${escape(last.after)}`);
      pending = [];
    };
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const text = line.text;
      if (openParentheses > 0) {
        pending.push(line);
        openParentheses = Math.max(0, openParentheses + balance(text));
        if (!openParentheses) flush();
        continue;
      }
      if (autoVerse || (verseEnd > 0 && index < verseEnd)) {
        flush();
        const signatureIndex = lines.findIndex((entry) => signature.test(entry.text));
        const end = autoVerse ? (signatureIndex < 0 ? lines.length : signatureIndex) : verseEnd;
        const length = end > index ? end - index : 0;
        if (length) {
          const poem = lines.slice(index, index + length);
          const last = poem.at(-1);
          const content = poem.map((entry, offset) => entry.text + (offset < poem.length - 1 ? entry.after : "")).join("");
          output.push(`<p class="detail-paragraph reading-verse">${escape(content)}</p>${escape(last.after)}`);
          index += length - 1;
          continue;
        }
      }
      if (!text.trim()) {
        flush();
        output.push(escape(text + line.after));
        continue;
      }
      if (signature.test(text)) {
        flush();
        output.push(`<p class="reading-signature">${escape(text)}</p>${escape(line.after)}`);
        continue;
      }
      if (heading.test(text.trim()) || sectionNames.has(text)) {
        flush();
        note = /^(说明|购买方式)/.test(text.trim());
        output.push(`<h4 class="reading-heading${note ? " reading-note" : ""}">${escape(text)}</h4>${escape(line.after)}`);
        continue;
      }
      const spec = specification(index);
      if (spec) {
        flush();
        const rows = [];
        while (index < lines.length && specification(index)) {
          const current = lines[index];
          const { prefix, label, colon, content, derived } = specification(index);
          let { count } = specification(index);
          let value = content;
          let after = lines[index + count - 1].after;
          if (rule.continuations?.[current.text] && rule.continuations[current.text] === lines[index + 1]?.text) {
            value += current.after + lines[index + 1].text;
            after = lines[index + 1].after;
            count += 1;
          }
          const syntax = prefix ? `<span class="reading-syntax" aria-hidden="true">${escape(prefix)}</span>` : "";
          const term = derived ? `<dt data-label="${escape(label)}：" aria-label="${escape(label)}"></dt>`
            : `<dt>${syntax}${escape(label + colon)}</dt>`;
          rows.push(`<div class="detail-spec-row">${term}<dd>${escape(value)}</dd></div>${escape(after)}`);
          index += count;
        }
        index -= 1;
        output.push(`<dl class="detail-specs reading-specs">${rows.join("")}</dl>`);
        continue;
      }
      const item = balance(text) > 0 ? null : text.match(numbering);
      if (item) {
        flush();
        note = false;
        const nameEnd = item[2].search(/[（(]/);
        const name = nameEnd > 0 && nameEnd <= 28 ? item[2].slice(0, nameEnd) : "";
        const content = name ? `<strong class="reading-item-name">${escape(name)}</strong><span>${escape(item[2].slice(nameEnd))}</span>` : escape(item[2]);
        output.push(`<div class="reading-item"><span class="reading-number">${escape(item[1])}</span><p class="reading-item-copy">${content}</p></div>${escape(line.after)}`);
        continue;
      }
      pending.push(line);
      openParentheses = Math.max(0, balance(text));
      if (!openParentheses && (note || (!paragraphOnBlank && !ends.size && !compact) || ends.has(text))) flush();
    }
    flush();
    if (suffix) output.push(`\n\n<p class="detail-theme reading-theme">${escape(theme)}</p>`);
    return { html: output.join(""), long: raw.length > 240, verse: autoVerse || verseEnd > 0 };
  }

  window.BelongsReading = Object.freeze({ title, headingHtml, format, anchors });
})();
