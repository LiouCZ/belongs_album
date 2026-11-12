(() => {
  const contacts = [
    { selector: "[data-wechat-contact]", id: "officialWechatQr", image: "assets/contact/official-wechat.png",
      width: 412, height: 416, alt: "BELONGS-OFFICIAL 官方微信二维码", caption: "官方微信 · BELONGS-OFFICIAL" },
    { selector: "[data-wechat-account]", id: "officialWechatAccountQr", image: "assets/contact/official-wechat-account.jpg",
      width: 1086, height: 1164, alt: "BELONGS OFFICIAL 微信公众号二维码", caption: "微信公众号 · BELONGS OFFICIAL" },
  ];
  let activeHide;

  function attachContact(contact) {
    const trigger = document.querySelector(contact.selector);
    if (!trigger) return;

    const panel = document.createElement("div");
    panel.id = contact.id;
    panel.className = "wechat-contact-popover";
    panel.setAttribute("role", "tooltip");
    panel.hidden = true;
    panel.innerHTML = `
      <img src="${contact.image}" width="${contact.width}" height="${contact.height}" alt="${contact.alt}" />
      <p>${contact.caption}</p>
    `;
    document.body.append(panel);

    let closeTimer;
    let triggerHovered = false;
    let panelHovered = false;
    let resizeScrollY;

    function positionPanel() {
      if (panel.hidden) return;
      const anchor = trigger.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      const left = Math.min(Math.max(12, anchor.left + (anchor.width - box.width) / 2), innerWidth - box.width - 12);
      const below = anchor.bottom + 10;
      const top = below + box.height <= innerHeight - 12 ? below : anchor.top - box.height - 10;
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.max(12, Math.min(top, innerHeight - box.height - 12))}px`;
    }

    function show() {
      clearTimeout(closeTimer);
      if (activeHide !== hide) activeHide?.();
      activeHide = hide;
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      positionPanel();
    }

    function hide() {
      clearTimeout(closeTimer);
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (activeHide === hide) activeHide = null;
    }

    function scheduleHide() {
      clearTimeout(closeTimer);
      // Bridge the small pointer gap between the account and its QR panel.
      closeTimer = setTimeout(() => {
        if (!triggerHovered && !panelHovered && !trigger.matches(":focus-visible")) hide();
      }, 180);
    }

    for (const [element, setHovered] of [
      [trigger, (value) => { triggerHovered = value; }],
      [panel, (value) => { panelHovered = value; }],
    ]) {
      element.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "mouse") return;
        setHovered(true);
        show();
      });
      element.addEventListener("pointerleave", (event) => {
        if (event.pointerType !== "mouse") return;
        setHovered(false);
        scheduleHide();
      });
    }

    trigger.addEventListener("focus", () => {
      if (trigger.matches(":focus-visible")) show();
    });
    trigger.addEventListener("blur", scheduleHide);
    trigger.addEventListener("click", () => panel.hidden ? show() : hide());
    document.addEventListener("pointerdown", (event) => {
      if (!trigger.contains(event.target) && !panel.contains(event.target)) hide();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hide();
    });
    window.addEventListener("resize", () => {
      // Responsive reflow can adjust scroll anchoring without a user scroll.
      resizeScrollY = window.scrollY;
      positionPanel();
    });
    window.addEventListener("scroll", () => {
      const resized = resizeScrollY === window.scrollY;
      resizeScrollY = undefined;
      if (panel.hidden) return;
      const anchor = trigger.getBoundingClientRect();
      if (resized || trigger.matches(":focus-visible") && anchor.bottom > 0 && anchor.top < innerHeight) positionPanel();
      else hide();
    }, { passive: true });
  }

  contacts.forEach(attachContact);
})();
