(() => {
  const trigger = document.querySelector("[data-mini-program]");
  if (!trigger) return;

  const dialog = document.createElement("dialog");
  dialog.id = "miniProgramDialog";
  dialog.className = "mini-program-dialog";
  dialog.setAttribute("aria-labelledby", "miniProgramTitle");
  dialog.innerHTML = `
    <header class="mini-program-header">
      <div><p>微信小程序</p><h2 id="miniProgramTitle">BELONGS B&amp;K</h2></div>
      <button class="mini-program-close" type="button" aria-label="关闭小程序" title="关闭">×</button>
    </header>
    <textarea class="mini-program-code" id="miniProgramCode" aria-label="小程序分享口令" readonly rows="3" spellcheck="false"></textarea>
    <button class="mini-program-copy" type="button">复制口令</button>
    <p class="mini-program-status" id="miniProgramStatus" role="status"></p>
  `;
  document.body.append(dialog);

  const field = dialog.querySelector("textarea");
  const copy = dialog.querySelector(".mini-program-copy");
  const status = dialog.querySelector("[role=status]");
  field.value = "#小程序://BELONGSB&K/kpn1xWp1jF1hyqu";

  trigger.addEventListener("click", () => {
    status.textContent = "";
    dialog.showModal();
    trigger.setAttribute("aria-expanded", "true");
  });
  dialog.querySelector(".mini-program-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => trigger.setAttribute("aria-expanded", "false"));
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });

  copy.addEventListener("click", async () => {
    copy.disabled = true;
    let copied = false;
    try {
      await navigator.clipboard.writeText(field.value);
      copied = true;
    } catch {
      if (!dialog.open) return;
      field.focus();
      field.select();
      try { copied = document.execCommand("copy"); } catch { /* Leave the code selected for manual copying. */ }
    } finally {
      copy.disabled = false;
    }
    if (!dialog.open) return;
    status.textContent = copied ? "口令已复制" : "自动复制不可用";
    if (copied) {
      field.setSelectionRange(0, 0);
      copy.focus();
    }
  });
})();
