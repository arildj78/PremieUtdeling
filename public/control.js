'use strict';
const socket = io();

// ── DOM refs ──────────────────────────────────────────────────────────────────
const sesFilter    = document.getElementById('sesFilter');
const strokeFilter = document.getElementById('strokeFilter');
const doneFilter   = document.getElementById('doneFilter');
const ceremonyList = document.getElementById('ceremonyList');
const selectedTitle = document.getElementById('selectedTitle');
const selectedMeta  = document.getElementById('selectedMeta');
const completedCheckbox = document.getElementById('completedCheckbox');
const revealModeSelect = document.getElementById('revealModeSelect');
const saveBtn         = document.getElementById('saveBtn');
const revealBackBtn   = document.getElementById('revealBackBtn');
const revealNextBtn   = document.getElementById('revealNextBtn');
const pushGirlsBtn    = document.getElementById('pushGirlsBtn');
const pushBoysBtn     = document.getElementById('pushBoysBtn');
const clearDisplayBtn = document.getElementById('clearDisplayBtn');
const resetDataBtn    = document.getElementById('resetDataBtn');
const screenHeaderHint = document.getElementById('screenHeaderHint');
const previewGirlsFrame = document.getElementById('previewGirlsFrame');
const previewBoysFrame  = document.getElementById('previewBoysFrame');

const SLOTS = {
  jenter: {
    gold:   { sel: document.getElementById('jGoldSelect'),   over: document.getElementById('jGoldOverride'),   clubSel: document.getElementById('jGoldClubSelect') },
    silver: { sel: document.getElementById('jSilverSelect'), over: document.getElementById('jSilverOverride'), clubSel: document.getElementById('jSilverClubSelect') },
    bronze: { sel: document.getElementById('jBronzeSelect'), over: document.getElementById('jBronzeOverride'), clubSel: document.getElementById('jBronzeClubSelect') }
  },
  gutter: {
    gold:   { sel: document.getElementById('gGoldSelect'),   over: document.getElementById('gGoldOverride'),   clubSel: document.getElementById('gGoldClubSelect') },
    silver: { sel: document.getElementById('gSilverSelect'), over: document.getElementById('gSilverOverride'), clubSel: document.getElementById('gSilverClubSelect') },
    bronze: { sel: document.getElementById('gBronzeSelect'), over: document.getElementById('gBronzeOverride'), clubSel: document.getElementById('gBronzeClubSelect') }
  }
};

const LOGO_NAMES = {
  jenter: {
    gold: document.getElementById('jGoldLogoName'),
    silver: document.getElementById('jSilverLogoName'),
    bronze: document.getElementById('jBronzeLogoName')
  },
  gutter: {
    gold: document.getElementById('gGoldLogoName'),
    silver: document.getElementById('gSilverLogoName'),
    bronze: document.getElementById('gBronzeLogoName')
  }
};

const REVEAL_ORDER = ['bronze', 'silver', 'gold'];

// ── State ─────────────────────────────────────────────────────────────────────
let db    = { clubs: [], swimmers: [], ceremonies: [] };
let state = { selectedCeremonyId: null, display: {} };

// ── Data helpers ──────────────────────────────────────────────────────────────
const clubById     = id => db.clubs.find(c => c.id === id);
const swimmerById  = id => db.swimmers.find(s => s.id === id);
const ceremonyById = id => db.ceremonies.find(c => c.id === id);

function clampRevealStep(step) {
  const numeric = Number(step);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(REVEAL_ORDER.length, numeric));
}

function selectedRevealMode() {
  return revealModeSelect?.value === 'step' ? 'step' : 'all';
}

function initialRevealStep(mode) {
  return mode === 'step' ? 0 : REVEAL_ORDER.length;
}

function applyRevealToPodium(podium, revealMode, revealStep) {
  if (revealMode !== 'step') return podium;

  const clampedStep = clampRevealStep(revealStep);
  const filteredPodium = { gold: null, silver: null, bronze: null };

  REVEAL_ORDER.forEach((medal, index) => {
    if (index < clampedStep) {
      filteredPodium[medal] = podium[medal] || null;
    }
  });

  return filteredPodium;
}

function buildEmptyDisplay(sex = 'jenter', revealMode = selectedRevealMode()) {
  return {
    blank: false,
    ceremonyId: null,
    title: 'Premieutdeling',
    subtitle: 'LÅMØ Nord 2026',
    sex,
    eventNumber: null,
    stroke: '',
    distance: null,
    revealMode,
    revealStep: initialRevealStep(revealMode),
    podium: { gold: null, silver: null, bronze: null }
  };
}

function eligibleSwimmers(ceremony, sex) {
  return db.swimmers.filter(sw => {
    if (sw.sex !== sex) return false;
    if (Boolean(sw.para) !== Boolean(ceremony.para)) return false;
    if (!ceremony.para && sw.birthYear !== ceremony.year) return false;
    if (!sw.events.includes(ceremony.stroke)) return false;
    return true;
  });
}

function buildWinner(swimmerId, nameOverride, manualClubId) {
  const swimmer = swimmerById(swimmerId);
  if (!swimmer && !nameOverride) return null;
  const club = nameOverride
    ? clubById(manualClubId) || (swimmer ? clubById(swimmer.clubId) : null)
    : (swimmer ? clubById(swimmer.clubId) : null);
  return {
    name:         nameOverride || swimmer?.name || '',
    clubName:     club?.name || '',
    clubLogoPath: club?.logoPath || ''
  };
}

function logoNameForSelection(swimmerId, manualClubId, nameOverride) {
  const swimmer = swimmerById(swimmerId);
  const club = nameOverride
    ? clubById(manualClubId) || (swimmer ? clubById(swimmer.clubId) : null)
    : (swimmer ? clubById(swimmer.clubId) : null);
  if (!club || !club.logoPath) return '-';
  const parts = club.logoPath.split('/');
  return decodeURIComponent(parts[parts.length - 1] || '-');
}

function fillClubSelect(sel, selectedClubId) {
  sel.innerHTML = '<option value="">Velg klubb-logo...</option>' +
    db.clubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (selectedClubId) sel.value = selectedClubId;
}

function updateManualClubState(sex, medal) {
  const slot = SLOTS[sex][medal];
  const hasSwimmer = Boolean(slot.sel.value);
  const hasManualName = slot.over.value.trim().length > 0;
  // Manual club choice is only relevant when manual name is used (and no swimmer selected).
  slot.clubSel.disabled = !(hasManualName && !hasSwimmer);
}

function updateAllManualClubStates() {
  ['jenter', 'gutter'].forEach(sex => {
    ['gold', 'silver', 'bronze'].forEach(medal => updateManualClubState(sex, medal));
  });
}

function sexLabel(sex) {
  return sex === 'gutter' ? 'Gutter' : 'Jenter';
}

function eventNumberForSex(ceremony, sex) {
  if (!Array.isArray(ceremony.eventNumbers) || ceremony.eventNumbers.length === 0) return null;
  if (ceremony.eventNumbers.length === 1) return ceremony.eventNumbers[0];
  return sex === 'gutter'
    ? ceremony.eventNumbers[ceremony.eventNumbers.length - 1]
    : ceremony.eventNumbers[0];
}

function buildDisplayPayload(cer, displaySex, revealMode = 'all', revealStep = initialRevealStep(revealMode), applyReveal = true) {
  const eventNumber = eventNumberForSex(cer, displaySex);
  const m = cer.medalists[displaySex];
  const clampedRevealStep = clampRevealStep(revealStep);
  const fullPodium = {
    gold:   buildWinner(m.goldSwimmerId,   m.goldNameOverride, m.goldClubId),
    silver: buildWinner(m.silverSwimmerId, m.silverNameOverride, m.silverClubId),
    bronze: buildWinner(m.bronzeSwimmerId, m.bronzeNameOverride, m.bronzeClubId)
  };

  return {
    blank: false,
    ceremonyId: cer.id,
    title: eventNumber
      ? `Øvelse ${eventNumber} | ${cer.stroke} | ${cer.distance}m | ${sexLabel(displaySex)}`
      : `${cer.stroke} | ${cer.distance}m | ${sexLabel(displaySex)}`,
    subtitle: `LÅMØ Nord 2026${cer.para ? ' | Para' : ''}`,
    sex: displaySex,
    eventNumber,
    stroke: cer.stroke,
    distance: cer.distance,
    revealMode,
    revealStep: clampedRevealStep,
    podium: applyReveal ? applyRevealToPodium(fullPodium, revealMode, clampedRevealStep) : fullPodium
  };
}

// ── Filters ───────────────────────────────────────────────────────────────────
function buildFilterOptions() {
  const sessions = [...new Set(db.ceremonies.map(c => c.sesId))].sort((a, b) => a - b);
  sesFilter.innerHTML = '<option value="all">Alle</option>' +
    sessions.map(s => `<option value="${s}">Session ${s}</option>`).join('');

  const strokes = [...new Set(db.ceremonies.map(c => c.stroke))].sort();
  strokeFilter.innerHTML = '<option value="all">Alle</option>' +
    strokes.map(s => `<option value="${s}">${s}</option>`).join('');
}

function filteredCeremonies() {
  return db.ceremonies.filter(c => {
    if (sesFilter.value !== 'all' && String(c.sesId) !== sesFilter.value) return false;
    if (strokeFilter.value !== 'all' && c.stroke !== strokeFilter.value) return false;
    if (doneFilter.value === 'active' && c.completed) return false;
    if (doneFilter.value === 'done'   && !c.completed) return false;
    return true;
  });
}

// ── Render list ───────────────────────────────────────────────────────────────
function renderList() {
  const list = filteredCeremonies();
  ceremonyList.innerHTML = list.map(c => {
    const sel   = state.selectedCeremonyId === c.id ? 'selected' : '';
    const done  = c.completed ? 'completed' : '';
    const badge = c.para ? '<span class="tag">Para</span>' : '';
    const sesLabel = c.sesId === 1 ? 'LÅMØ Nord 2026' : `Session ${c.sesId}`;
    return `<li><button class="ceremony-item ${sel} ${done}" data-id="${c.id}">
      <div class="line1">${c.title} ${badge}</div>
      <div class="line2">${sesLabel} &mdash; ${c.stroke}</div>
    </button></li>`;
  }).join('');
}

// ── Populate selects ──────────────────────────────────────────────────────────
function fillSelect(sel, swimmers, selectedId) {
  const sorted = [...swimmers].sort((a, b) => a.name.localeCompare(b.name, 'no'));
  sel.innerHTML = '<option value="">Velg svommer...</option>' +
    sorted.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  if (selectedId) sel.value = selectedId;
}

// ── Render editor ─────────────────────────────────────────────────────────────
function renderEditor() {
  const cer = ceremonyById(state.selectedCeremonyId);
  if (!cer) {
    selectedTitle.textContent = 'Ingen seremoni valgt';
    selectedMeta.textContent  = '';
    ['jenter', 'gutter'].forEach(sex => {
      ['gold', 'silver', 'bronze'].forEach(medal => {
        SLOTS[sex][medal].sel.innerHTML = '';
        SLOTS[sex][medal].over.value = '';
        SLOTS[sex][medal].clubSel.innerHTML = '';
      });
    });
    completedCheckbox.checked = false;
    return;
  }

  selectedTitle.textContent = cer.title;
  const sesLabel = cer.sesId === 1 ? 'LÅMØ Nord 2026' : `Session ${cer.sesId}`;
  selectedMeta.textContent  = `${sesLabel} | ${cer.stroke} ${cer.distance}m${cer.para ? ' | Para' : ''}`;

  ['jenter', 'gutter'].forEach(sex => {
    const swimmers = eligibleSwimmers(cer, sex);
    const m = cer.medalists[sex];
    fillSelect(SLOTS[sex].gold.sel,   swimmers, m.goldSwimmerId);
    fillSelect(SLOTS[sex].silver.sel, swimmers, m.silverSwimmerId);
    fillSelect(SLOTS[sex].bronze.sel, swimmers, m.bronzeSwimmerId);
    fillClubSelect(SLOTS[sex].gold.clubSel, m.goldClubId || '');
    fillClubSelect(SLOTS[sex].silver.clubSel, m.silverClubId || '');
    fillClubSelect(SLOTS[sex].bronze.clubSel, m.bronzeClubId || '');
    SLOTS[sex].gold.over.value   = m.goldNameOverride   || '';
    SLOTS[sex].silver.over.value = m.silverNameOverride || '';
    SLOTS[sex].bronze.over.value = m.bronzeNameOverride || '';
    LOGO_NAMES[sex].gold.textContent = `Logo: ${logoNameForSelection(m.goldSwimmerId, m.goldClubId, m.goldNameOverride || '')}`;
    LOGO_NAMES[sex].silver.textContent = `Logo: ${logoNameForSelection(m.silverSwimmerId, m.silverClubId, m.silverNameOverride || '')}`;
    LOGO_NAMES[sex].bronze.textContent = `Logo: ${logoNameForSelection(m.bronzeSwimmerId, m.bronzeClubId, m.bronzeNameOverride || '')}`;
  });

  updateAllManualClubStates();

  completedCheckbox.checked = Boolean(cer.completed);
}

function updatePreviewActive() {
  const activeSex = state.display?.blank === true ? null : (state.display?.sex ?? null);
  const girlsWrapper = previewGirlsFrame?.parentElement;
  const boysWrapper  = previewBoysFrame?.parentElement;
  girlsWrapper?.classList.toggle('active', activeSex === 'jenter');
  boysWrapper?.classList.toggle('active',  activeSex === 'gutter');
}

function updateRevealControls() {
  const display = state.display || {};
  const isStepMode = display.blank !== true && display.revealMode === 'step';
  const revealStep = clampRevealStep(display.revealStep);

  revealBackBtn.disabled = !isStepMode || revealStep <= 0;
  revealNextBtn.disabled = !isStepMode || revealStep >= REVEAL_ORDER.length;
}

function updateScreenHeaderHint() {
  const display = state.display || {};
  if (display.blank === true) {
    screenHeaderHint.textContent = 'På skjerm nå: Tom skjerm';
    return;
  }

  const title = display.title || 'Premieutdeling';
  const subtitle = display.subtitle || '';
  const suffix = subtitle ? ` | ${subtitle}` : '';
  screenHeaderHint.textContent = `På skjerm nå: ${title}${suffix}`;
}

function renderAll() {
  renderList();
  renderEditor();
  renderPreview();
  updatePreviewActive();
  updateRevealControls();
  updateScreenHeaderHint();
}

function renderPreview() {
  const cer = ceremonyById(state.selectedCeremonyId);
  const revealMode = selectedRevealMode();
  const liveDisplay = state.display || {};

  const girlsRevealMode = cer && liveDisplay.blank !== true && liveDisplay.sex === 'jenter' && liveDisplay.ceremonyId === cer.id
    ? (liveDisplay.revealMode === 'step' ? 'step' : 'all')
    : revealMode;
  const boysRevealMode = cer && liveDisplay.blank !== true && liveDisplay.sex === 'gutter' && liveDisplay.ceremonyId === cer.id
    ? (liveDisplay.revealMode === 'step' ? 'step' : 'all')
    : revealMode;

  const girlsRevealStep = cer && liveDisplay.blank !== true && liveDisplay.sex === 'jenter' && liveDisplay.ceremonyId === cer.id
    ? clampRevealStep(liveDisplay.revealStep)
    : initialRevealStep(girlsRevealMode);
  const boysRevealStep = cer && liveDisplay.blank !== true && liveDisplay.sex === 'gutter' && liveDisplay.ceremonyId === cer.id
    ? clampRevealStep(liveDisplay.revealStep)
    : initialRevealStep(boysRevealMode);

  const girlsDisplay = cer
    ? { ...buildDisplayPayload(cer, 'jenter', girlsRevealMode, girlsRevealStep, false), previewRevealStyle: true }
    : { ...buildEmptyDisplay('jenter', revealMode), previewRevealStyle: true };
  const boysDisplay = cer
    ? { ...buildDisplayPayload(cer, 'gutter', boysRevealMode, boysRevealStep, false), previewRevealStyle: true }
    : { ...buildEmptyDisplay('gutter', revealMode), previewRevealStyle: true };

  if (previewGirlsFrame?.contentWindow) {
    previewGirlsFrame.contentWindow.postMessage({ type: 'preview:update', display: girlsDisplay }, window.location.origin);
  }
  if (previewBoysFrame?.contentWindow) {
    previewBoysFrame.contentWindow.postMessage({ type: 'preview:update', display: boysDisplay }, window.location.origin);
  }
}

// ── Read form into ceremony object ─────────────────────────────────────────────
function syncFormToCeremony() {
  const cer = ceremonyById(state.selectedCeremonyId);
  if (!cer) return;
  ['jenter', 'gutter'].forEach(sex => {
    ['gold', 'silver', 'bronze'].forEach(m => {
      cer.medalists[sex][m + 'SwimmerId']    = SLOTS[sex][m].sel.value  || null;
      cer.medalists[sex][m + 'NameOverride'] = SLOTS[sex][m].over.value.trim();
      cer.medalists[sex][m + 'ClubId']       = SLOTS[sex][m].clubSel.value || null;
      updateManualClubState(sex, m);
      LOGO_NAMES[sex][m].textContent = `Logo: ${logoNameForSelection(
        SLOTS[sex][m].sel.value || null,
        SLOTS[sex][m].clubSel.value || null,
        SLOTS[sex][m].over.value.trim()
      )}`;
    });
  });
  cer.completed = completedCheckbox.checked;
  renderPreview();
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function saveData() {
  await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db)
  });
}

async function postState(patch) {
  await fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
}

// ── Button handlers ───────────────────────────────────────────────────────────
async function handleSave() {
  syncFormToCeremony();
  await saveData();
  renderAll();
}

async function handlePush(displaySex) {
  const cer = ceremonyById(state.selectedCeremonyId);
  if (!cer) { alert('Velg en seremoni forst.'); return; }
  syncFormToCeremony();
  await saveData();
  const revealMode = selectedRevealMode();

  await postState({
    selectedCeremonyId: cer.id,
    display: buildDisplayPayload(cer, displaySex, revealMode)
  });
}

async function handleReveal(delta) {
  const display = state.display || {};
  if (display.blank === true || display.revealMode !== 'step') return;

  const currentStep = clampRevealStep(display.revealStep);
  const nextStep = clampRevealStep(currentStep + delta);
  if (nextStep === currentStep) return;

  const ceremony = ceremonyById(display.ceremonyId);
  if (!ceremony) return;

  await postState({
    display: buildDisplayPayload(ceremony, display.sex === 'gutter' ? 'gutter' : 'jenter', 'step', nextStep)
  });
}

async function handleClearDisplay() {
  await postState({
    display: { blank: true }
  });
}

async function handleSelectCeremony(id) {
  state.selectedCeremonyId = id;
  renderAll();
  await postState({ selectedCeremonyId: id });
}

async function handleResetData() {
  if (!confirm('Tilbakestille all data? Dette kan ikke angres.')) return;
  
  // Reset all medalists in all ceremonies
  db.ceremonies.forEach(cer => {
    cer.medalists = {
      jenter: { goldSwimmerId: null, goldNameOverride: '', goldClubId: '', silverSwimmerId: null, silverNameOverride: '', silverClubId: '', bronzeSwimmerId: null, bronzeNameOverride: '', bronzeClubId: '' },
      gutter: { goldSwimmerId: null, goldNameOverride: '', goldClubId: '', silverSwimmerId: null, silverNameOverride: '', silverClubId: '', bronzeSwimmerId: null, bronzeNameOverride: '', bronzeClubId: '' }
    };
    cer.completed = false;
  });
  
  await saveData();
  state.selectedCeremonyId = null;
  await postState({ selectedCeremonyId: null });
  renderAll();
}

// ── Event listeners ───────────────────────────────────────────────────────────
[sesFilter, strokeFilter, doneFilter].forEach(el => el.addEventListener('change', renderList));

ceremonyList.addEventListener('click', e => {
  const btn = e.target.closest('button[data-id]');
  if (btn) handleSelectCeremony(btn.dataset.id);
});

// Live sync: any change in the form updates the ceremony object in memory
Object.values(SLOTS).forEach(sex =>
  Object.values(sex).forEach(({ sel, over, clubSel }) => {
    sel.addEventListener('change', syncFormToCeremony);
    over.addEventListener('input',  syncFormToCeremony);
    clubSel.addEventListener('change', syncFormToCeremony);
  })
);
completedCheckbox.addEventListener('change', syncFormToCeremony);
revealModeSelect.addEventListener('change', renderPreview);

saveBtn.addEventListener('click',         handleSave);
revealBackBtn.addEventListener('click',   () => handleReveal(-1));
revealNextBtn.addEventListener('click',   () => handleReveal(1));
pushGirlsBtn.addEventListener('click',    () => handlePush('jenter'));
pushBoysBtn.addEventListener('click',     () => handlePush('gutter'));
clearDisplayBtn.addEventListener('click', handleClearDisplay);
resetDataBtn.addEventListener('click',    handleResetData);
previewGirlsFrame.addEventListener('load', renderPreview);
previewBoysFrame.addEventListener('load', renderPreview);

// ── Socket events ─────────────────────────────────────────────────────────────
socket.on('data:update', newData => { db = newData; renderAll(); });
socket.on('state:update', newState => {
  state = { ...state, ...newState, display: { ...state.display, ...(newState.display || {}) } };
  renderAll();
});

// ── Initial load ──────────────────────────────────────────────────────────────
async function init() {
  const res = await fetch('/api/data');
  const payload = await res.json();
  db    = payload.data;
  state = payload.state;
  buildFilterOptions();
  if (!state.selectedCeremonyId && db.ceremonies.length > 0) {
    state.selectedCeremonyId = db.ceremonies[0].id;
  }
  renderAll();
}

init();
