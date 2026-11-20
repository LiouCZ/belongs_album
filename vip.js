const form = document.querySelector("#vipForm");
const resultText = document.querySelector("#resultText");
const copyButton = document.querySelector("#copyButton");
const exportButton = document.querySelector("#exportButton");
const copyStatus = document.querySelector("#copyStatus");

const singleFields = ["称呼", "微信昵称", "微信号", "手机号", "VIP 等级", "预算区间", "款式描述", "其他备注"];
const multiFields = ["配件类", "主件类", "其他方向", "主题元素"];
let statusMessage = null;

function t(source, vars = {}) {
  return window.BelongsI18n?.t(source, vars)
    ?? source.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
}

function updateStatus() {
  if (!statusMessage) {
    copyStatus.textContent = "";
    return;
  }

  const vars = typeof statusMessage.vars === "function" ? statusMessage.vars() : statusMessage.vars;
  copyStatus.textContent = t(statusMessage.source, vars);
}

function setStatus(source, vars = {}) {
  statusMessage = { source, vars };
  updateStatus();
}

function fieldValue(name) {
  const field = form.elements[name];
  if (!field) return "";

  if (field instanceof RadioNodeList) {
    const checked = [...field].find((item) => item.checked);
    return checked ? checked.value : "";
  }

  return String(field.value || "").trim();
}

function checkedValues(name) {
  return [...form.querySelectorAll(`input[name="${CSS.escape(name)}"]:checked`)].map((item) => item.value);
}

function line(label, value) {
  const separator = window.BelongsI18n?.english() ? ": " : "：";
  return `${t(label)}${separator}${value || t("未填写")}`;
}

function buildResult() {
  const lines = [t("BELONGS B&K VIP 定制意向登记"), ""];

  for (const name of singleFields) {
    if (name === "款式描述" || name === "其他备注") continue;
    const value = fieldValue(name);
    lines.push(line(name, name === "VIP 等级" || name === "预算区间" ? t(value) : value));
  }

  lines.push("");
  for (const name of multiFields) {
    const separator = window.BelongsI18n?.english() ? ", " : "、";
    lines.push(line(name, checkedValues(name).map((value) => t(value)).join(separator)));
  }

  lines.push("");
  lines.push(line("款式描述", fieldValue("款式描述")));
  lines.push(line("其他备注", fieldValue("其他备注")));

  return lines.join("\n");
}

function updateResult() {
  resultText.value = buildResult();
}

function todayStamp() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function createFieldSnapshots() {
  const pairs = [...form.querySelectorAll(".field-grid input, textarea")].map((field) => {
    const isInput = field instanceof HTMLInputElement;
    const snapshot = document.createElement("div");
    snapshot.className = isInput ? "export-input-snapshot" : "export-textarea-snapshot";
    snapshot.textContent = field.value || (isInput ? field.placeholder : "");
    snapshot.classList.toggle("is-placeholder", isInput && !field.value);
    snapshot.style.minHeight = `${field.offsetHeight}px`;
    field.classList.add("export-field-source");
    field.after(snapshot);
    return { field, snapshot };
  });

  return () => {
    for (const { field, snapshot } of pairs) {
      field.classList.remove("export-field-source");
      snapshot.remove();
    }
  };
}

function enforceLimit(group, input) {
  const max = Number(group.dataset.max || 0);
  if (!max || !input.checked) return;

  const checked = [...group.querySelectorAll("input[type='checkbox']:checked")];
  if (checked.length <= max) return;

  input.checked = false;
  group.classList.remove("is-limited");
  void group.offsetWidth;
  group.classList.add("is-limited");
  setStatus("{label}最多选择 {max} 项", () => ({
    label: window.BelongsI18n?.english()
      ? t(input.name || "该项")
      : group.querySelector("legend")?.textContent.trim() || t("该项"),
    max,
  }));
}

async function copyResult() {
  updateResult();
  resultText.select();

  try {
    await navigator.clipboard.writeText(resultText.value);
    setStatus("已复制登记内容");
  } catch {
    document.execCommand("copy");
    setStatus("已复制登记内容");
  }

  window.getSelection()?.removeAllRanges();
}

async function exportImage() {
  updateResult();

  if (!window.html2canvas) {
    setStatus("导出组件加载失败，请刷新页面后重试");
    return;
  }

  setStatus("正在生成图片...");
  copyButton.disabled = true;
  exportButton.disabled = true;
  const restoreFieldSnapshots = createFieldSnapshots();
  document.body.classList.add("is-exporting");
  await document.fonts?.ready;
  await nextFrame();

  try {
    const canvas = await window.html2canvas(document.querySelector(".vip-page"), {
      backgroundColor: "#f5f0e8",
      scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
      scrollX: 0,
      scrollY: -window.scrollY,
      useCORS: true,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });
    const link = document.createElement("a");
    link.download = `belongs-vip-registration-${todayStamp()}.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.append(link);
    link.click();
    link.remove();
    setStatus("图片已生成并开始下载");
  } catch (error) {
    console.error(error);
    setStatus("图片生成失败，请稍后重试");
  } finally {
    document.body.classList.remove("is-exporting");
    restoreFieldSnapshots();
    copyButton.disabled = false;
    exportButton.disabled = false;
  }
}

form.addEventListener("change", (event) => {
  const input = event.target.closest("input");
  if (!input) return;

  const group = input.closest(".choice-group");
  if (group) enforceLimit(group, input);
  updateResult();
});

form.addEventListener("input", updateResult);

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    statusMessage = null;
    updateStatus();
    updateResult();
  }, 0);
});

copyButton.addEventListener("click", copyResult);
exportButton.addEventListener("click", exportImage);

window.addEventListener("belongs:language-change", () => {
  updateResult();
  updateStatus();
});

updateResult();
