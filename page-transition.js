const pageNav = document.querySelector(".site-nav");
const transitionMotion = window.matchMedia("(prefers-reduced-motion: no-preference)");
const transitionKey = "belongs:transition-to";

function createHourglassOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "page-hourglass-transition";
  overlay.setAttribute("aria-hidden", "true");
  const logo = document.createElement("img");
  logo.src = "assets/belongs-logo.png";
  logo.alt = "";
  overlay.append(logo);
  document.body.append(overlay);
  return overlay;
}

if (pageNav) {
  let destination = "";
  try {
    destination = sessionStorage.getItem(transitionKey) || "";
    sessionStorage.removeItem(transitionKey);
  } catch {
    // The exit animation still works when file-page storage is restricted.
  }

  if (destination === location.pathname && transitionMotion.matches) {
    const overlay = createHourglassOverlay();
    overlay.classList.add("is-entering");
    overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
    setTimeout(() => overlay.remove(), 610);
  }

  let leaving = false;
  pageNav.addEventListener("click", (event) => {
    const link = event.target.closest("a.top-link[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target && link.target !== "_self" || !transitionMotion.matches) return;
    const target = new URL(link.href);
    if (target.pathname === location.pathname || new URL(".", target).href !== new URL(".", location.href).href) return;
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem(transitionKey, target.pathname); } catch { /* Navigation remains available. */ }
    const overlay = createHourglassOverlay();
    overlay.classList.add("is-leaving");
    let navigated = false;
    const navigate = () => {
      if (navigated) return;
      navigated = true;
      location.assign(link.href);
    };
    overlay.addEventListener("animationend", navigate, { once: true });
    setTimeout(navigate, 570);
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      document.querySelector(".page-hourglass-transition")?.remove();
      leaving = false;
    }
  });
}
