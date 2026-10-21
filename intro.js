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
let introIndex = 0;

function showIntroSlide(index) {
  introIndex = (index + introSlides.length) % introSlides.length;
  introImage.src = introSlides[introIndex].src;
  introImage.alt = introSlides[introIndex].alt;
  introCount.textContent = `${introIndex + 1} / ${introSlides.length}`;
}

document.querySelector("#prevIntro").addEventListener("click", () => showIntroSlide(introIndex - 1));
document.querySelector("#nextIntro").addEventListener("click", () => showIntroSlide(introIndex + 1));
document.querySelector("#closeIntro").addEventListener("click", () => introDialog.close());

introDialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    showIntroSlide(introIndex + (event.key === "ArrowRight" ? 1 : -1));
  }
});

introDialog.addEventListener("click", (event) => {
  if (event.target === introDialog) introDialog.close();
});

introDialog.showModal();
document.querySelector("#closeIntro").focus();
