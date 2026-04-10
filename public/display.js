'use strict';
const params = new URLSearchParams(window.location.search);
const isPreview = params.get('preview') === '1';
const socket = isPreview ? null : io();

// ── DOM refs ──────────────────────────────────────────────────────────────────
const displayTitle    = document.getElementById('displayTitle');
const displaySubtitle  = document.getElementById('displaySubtitle');

const DOM = {
  gold:    { name: document.getElementById('goldName'),   logo: document.getElementById('goldLogo'),   club: document.getElementById('goldClub') },
  silver:  { name: document.getElementById('silverName'), logo: document.getElementById('silverLogo'), club: document.getElementById('silverClub') },
  bronze:  { name: document.getElementById('bronzeName'), logo: document.getElementById('bronzeLogo'), club: document.getElementById('bronzeClub') }
};

const CARD_DOM = {
  gold: document.querySelector('.gold-card'),
  silver: document.querySelector('.silver-card'),
  bronze: document.querySelector('.bronze-card')
};

document.body.classList.toggle('preview-mode', isPreview);

const REVEAL_ORDER = ['bronze', 'silver', 'gold'];

function clampRevealStep(step) {
  const numeric = Number(step);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(REVEAL_ORDER.length, numeric));
}

function visiblePodium(disp) {
  const fullPodium = disp?.podium || {};
  if (disp?.previewRevealStyle === true) return fullPodium;
  if (disp?.revealMode !== 'step') return fullPodium;

  const revealStep = clampRevealStep(disp?.revealStep);
  const hiddenPodium = { gold: null, silver: null, bronze: null };

  REVEAL_ORDER.forEach((medal, index) => {
    if (index < revealStep) {
      hiddenPodium[medal] = fullPodium[medal] || null;
    }
  });

  return hiddenPodium;
}

function updatePreviewRevealStyling(disp) {
  ['gold', 'silver', 'bronze'].forEach(medal => {
    CARD_DOM[medal]?.classList.remove('preview-unrevealed');
  });

  if (!isPreview || disp?.previewRevealStyle !== true || disp?.revealMode !== 'step') return;

  const revealStep = clampRevealStep(disp?.revealStep);
  REVEAL_ORDER.forEach((medal, index) => {
    if (index >= revealStep) {
      CARD_DOM[medal]?.classList.add('preview-unrevealed');
    }
  });
}

function renderSlot(slot, winner) {
  if (!winner) {
    slot.name.textContent  = '';
    slot.club.textContent  = '';
    slot.logo.style.display = 'none';
    slot.logo.src = '';
    return;
  }
  slot.name.textContent = winner.name || '';
  slot.club.textContent = winner.clubName || '';
  if (winner.clubLogoPath) {
    slot.logo.src          = winner.clubLogoPath;
    slot.logo.style.display = 'block';
  } else {
    slot.logo.style.display = 'none';
    slot.logo.src = '';
  }
}

function renderDisplay(disp) {
  const isBlank = !disp || disp.blank === true;
  document.body.classList.toggle('display-blank', isBlank);
  if (isBlank) {
    updatePreviewRevealStyling(null);
    return;
  }

  displayTitle.textContent    = disp?.title    || 'Premieutdeling';
  displaySubtitle.textContent = disp?.subtitle || 'Zeekit L\u00c5M\u00d8 Nord 2026';

  const podium = visiblePodium(disp);
  updatePreviewRevealStyling(disp);

  ['gold', 'silver', 'bronze'].forEach(m => {
    renderSlot(DOM[m], podium[m] || null);
  });
}

if (isPreview) {
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'preview:update') return;
    renderDisplay(event.data.display || {});
  });
  renderDisplay({
    title: 'Premieutdeling',
    subtitle: 'LÅMØ Nord 2026',
    podium: { gold: null, silver: null, bronze: null }
  });
} else {
  socket.on('state:update', newState => renderDisplay(newState.display || {}));

  (async () => {
    const res     = await fetch('/api/data');
    const payload = await res.json();
    renderDisplay(payload.state?.display || {});
  })();
}
