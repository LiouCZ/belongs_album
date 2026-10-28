const introSlides = [
  {
    src: "assets/intro/serpent.png",
    alt: "蛇元素系列：ETERNAL · TIMELESS · GUARDING。Your classic beauty。",
  },
  {
    src: "assets/intro/eagle.png",
    alt: "鹰隼羽翼元素系列：FREEDOM · COURAGE · STRENGTH。Soar towards your dreams。",
  },
  {
    src: "assets/intro/cross.png",
    alt: "十字元素系列：LOVE · LIGHT · BLESS。Pray for you。",
  },
];

const introDialog = document.querySelector("#introDialog");
const introImage = document.querySelector("#introImage");
const introCount = document.querySelector("#introCount");
const introSeenKey = "belongs:intro-seen";
let introIndex = 0;
let introSeen = false;

try {
  introSeen = localStorage.getItem(introSeenKey) === "1";
} catch {
  // Local file storage can be unavailable in some browsers.
}

function showIntroSlide(index) {
  introIndex = (index + introSlides.length) % introSlides.length;
  introImage.src = introSlides[introIndex].src;
  introImage.alt = introSlides[introIndex].alt;
  introCount.textContent = `${introIndex + 1} / ${introSlides.length}`;
}

function markIntroSeen() {
  try {
    localStorage.setItem(introSeenKey, "1");
  } catch {
    // The dialog still closes when storage is unavailable.
  }
}

document.querySelector("#prevIntro").addEventListener("click", () => showIntroSlide(introIndex - 1));
document.querySelector("#nextIntro").addEventListener("click", () => showIntroSlide(introIndex + 1));
document.querySelector("#openIntro").addEventListener("click", () => {
  showIntroSlide(0);
  introDialog.showModal();
  document.querySelector("#closeIntro").focus();
});
document.querySelector("#closeIntro").addEventListener("click", () => {
  markIntroSeen();
  introDialog.close();
});

introDialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    showIntroSlide(introIndex + (event.key === "ArrowRight" ? 1 : -1));
  }
});

introDialog.addEventListener("click", (event) => {
  if (event.target === introDialog) introDialog.close();
});

introDialog.addEventListener("close", markIntroSeen);

if (!introSeen) {
  introDialog.showModal();
  document.querySelector("#closeIntro").focus();
}
