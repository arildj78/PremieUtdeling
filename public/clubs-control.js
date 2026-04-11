'use strict';

const counterEl = document.getElementById('counter');
const previewNameEl = document.getElementById('previewName');
const previewLogoEl = document.getElementById('previewLogo');
const jumpSelectEl = document.getElementById('jumpSelect');
const prevBtnEl = document.getElementById('prevBtn');
const nextBtnEl = document.getElementById('nextBtn');

let slides = [];
let currentIndex = 0;

function populateJumpList() {
  jumpSelectEl.innerHTML = '';
  slides.forEach((slide, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index + 1}. ${slide.teamName}`;
    jumpSelectEl.appendChild(option);
  });
}

function renderController() {
  const total = slides.length;
  counterEl.textContent = formatClubCounter(currentIndex, total);

  const current = slides[currentIndex];
  if (current) {
    previewNameEl.textContent = current.teamName;
    previewLogoEl.src = current.logo;
    previewLogoEl.style.display = 'block';
  } else {
    previewNameEl.textContent = 'Ingen klubber funnet';
    previewLogoEl.style.display = 'none';
  }

  prevBtnEl.disabled = currentIndex <= 0;
  nextBtnEl.disabled = total === 0 || currentIndex >= total - 1;
  jumpSelectEl.value = String(currentIndex);
}

prevBtnEl.addEventListener('click', () => {
  socket.emit('clubs:prev');
});

nextBtnEl.addEventListener('click', () => {
  socket.emit('clubs:next');
});

jumpSelectEl.addEventListener('change', () => {
  socket.emit('clubs:set', Number(jumpSelectEl.value));
});

socket.on('clubs:update', (state) => {
  if (Array.isArray(state.slides)) {
    slides = state.slides;
    populateJumpList();
  }
  currentIndex = Number(state.currentIndex) || 0;
  renderController();
});

(async function init() {
  const data = await fetchClubSlides();
  slides = data.slides || [];
  currentIndex = Number(data.currentIndex) || 0;
  populateJumpList();
  renderController();
})();