const stampQuotes = [
  { text: "手作，即是一段等待之旅。", title: "等待", year: "2021" },
  { text: "作品不论尺寸，皆可发光发热。", title: "见微知著", year: "2021" },
  { text: "有光，所以明亮；有翼，所以远翔。", title: "光之翼", year: "2022" },
  { text: "金银有价，情感无价，艺术无价。", title: "持续创作", year: "2022" },
];

const nav = document.querySelector(".site-nav");
if (nav) {
  const trigger = document.createElement("button");
  trigger.id = "siteEggTrigger";
  trigger.className = "site-egg-trigger";
  trigger.type = "button";
  trigger.title = "Belongs 印记";
  trigger.setAttribute("aria-label", "打开 Belongs 印记");
  trigger.textContent = "✧";

  const links = [...nav.querySelectorAll(".top-link")];
  nav.insertBefore(trigger, links[Math.floor(Math.random() * (links.length + 1))] || null);

  const dialog = document.createElement("dialog");
  dialog.id = "siteEggDialog";
  dialog.className = "site-egg-dialog";
  dialog.setAttribute("aria-label", "Belongs 印记");

  const header = document.createElement("div");
  header.className = "site-egg-header";
  const heading = document.createElement("span");
  heading.textContent = "BELONGS / 印记";
  const close = document.createElement("button");
  close.type = "button";
  close.title = "关闭印记";
  close.setAttribute("aria-label", "关闭印记");
  close.textContent = "×";
  header.append(heading, close);

  const quote = document.createElement("blockquote");
  quote.className = "site-egg-quote";
  const quoteText = document.createElement("p");
  const quoteSource = document.createElement("cite");
  quote.append(quoteText, quoteSource);
  dialog.append(header, quote);

  const discovery = document.querySelector(".discovery-strip");
  if (discovery) {
    discovery.hidden = false;
    dialog.append(discovery);
  }
  document.body.append(dialog);

  let lastQuoteIndex = -1;
  trigger.addEventListener("click", () => {
    const choices = stampQuotes.map((_, index) => index).filter((index) => index !== lastQuoteIndex);
    lastQuoteIndex = choices[Math.floor(Math.random() * choices.length)];
    const selected = stampQuotes[lastQuoteIndex];
    quoteText.textContent = `“${selected.text}”`;
    quoteSource.textContent = `官方图文《${selected.title}》 · ${selected.year}`;
    window.dispatchEvent(new Event("belongs:refresh-discovery"));
    dialog.showModal();
  });

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}
