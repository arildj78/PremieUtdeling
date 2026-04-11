'use strict';

const teamNameEl = document.getElementById('teamName');
const teamLogoEl = document.getElementById('teamLogo');
const bgLayerEl = document.getElementById('bgLayer');
const teamCardEl = document.getElementById('teamCard');
const stageCanvasEl = document.getElementById('stageCanvas');

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 768;

let slides = [];
let currentIndex = 0;

function updateStageScale() {
  const scale = Math.min(window.innerWidth / BASE_WIDTH, window.innerHeight / BASE_HEIGHT);
  stageCanvasEl.style.transform = `scale(${scale})`;
}

function renderSlide(index) {
  if (!slides.length) {
    teamNameEl.textContent = 'Ingen klubber konfigurert';
    teamLogoEl.style.display = 'none';
    return;
  }

  const slide = slides[index];
  if (!slide) return;

  teamNameEl.textContent = slide.teamName;
  teamLogoEl.src = slide.logo;
  teamLogoEl.style.display = 'block';

  teamCardEl.classList.remove('reveal');
  void teamCardEl.offsetWidth;
  teamCardEl.classList.add('reveal');
}

socket.on('clubs:update', (state) => {
  if (Array.isArray(state.slides)) {
    slides = state.slides;
  }
  currentIndex = Number(state.currentIndex) || 0;
  renderSlide(currentIndex);
});

window.addEventListener('resize', updateStageScale);
document.addEventListener('fullscreenchange', updateStageScale);

(async function init() {
  const data = await fetchClubSlides();
  slides = data.slides || [];
  currentIndex = Number(data.currentIndex) || 0;
  updateStageScale();
  renderSlide(currentIndex);
})();