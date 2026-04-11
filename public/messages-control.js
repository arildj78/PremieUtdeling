'use strict';

const socket = io();

const titleInput = document.getElementById('titleInput');
const messageInput = document.getElementById('messageInput');
const presetSelect = document.getElementById('presetSelect');
const showNowBtn = document.getElementById('showNowBtn');
const savePresetBtn = document.getElementById('savePresetBtn');
const loadPresetBtn = document.getElementById('loadPresetBtn');
const showPresetBtn = document.getElementById('showPresetBtn');
const showRandomBtn = document.getElementById('showRandomBtn');
const deletePresetBtn = document.getElementById('deletePresetBtn');
const clearBtn = document.getElementById('clearBtn');
const liveStatus = document.getElementById('liveStatus');

let messageState = {
  blank: true,
  title: 'Beskjeder til svommere',
  lines: [],
  currentIndex: -1,
  text: ''
};

function renderPresetSelect(lines, selectedIndex = -1) {
  presetSelect.innerHTML = '';
  lines.forEach((line, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index + 1}. ${line}`;
    presetSelect.appendChild(option);
  });

  if (lines.length === 0) {
    const option = document.createElement('option');
    option.value = '-1';
    option.textContent = 'Ingen presets';
    presetSelect.appendChild(option);
    presetSelect.disabled = true;
    loadPresetBtn.disabled = true;
    showPresetBtn.disabled = true;
    showRandomBtn.disabled = true;
    deletePresetBtn.disabled = true;
    return;
  }

  presetSelect.disabled = false;
  loadPresetBtn.disabled = false;
  showPresetBtn.disabled = false;
  showRandomBtn.disabled = false;
  deletePresetBtn.disabled = false;
  const safeIndex = Math.max(0, Math.min(selectedIndex, lines.length - 1));
  presetSelect.value = String(safeIndex);
}

function selectedPresetText() {
  const lines = messageState.lines || [];
  const selectedIndex = Number(presetSelect.value);
  if (selectedIndex < 0 || selectedIndex >= lines.length) return '';
  return lines[selectedIndex];
}

function renderState() {
  titleInput.value = messageState.title || 'Beskjeder til svommere';
  renderPresetSelect(messageState.lines || [], messageState.currentIndex);

  if (messageState.blank || !messageState.text) {
    liveStatus.textContent = 'Ingen aktiv melding';
  } else {
    liveStatus.textContent = `Live: ${messageState.text}`;
  }
}

function publishText(text, index = -1) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;

  socket.emit('messages:update', {
    title: titleInput.value.trim() || 'Beskjeder til svommere',
    blank: false,
    currentIndex: index,
    text: trimmed
  });
}

showNowBtn.addEventListener('click', () => {
  publishText(messageInput.value, -1);
});

savePresetBtn.addEventListener('click', () => {
  const newPreset = String(messageInput.value || '').trim();
  if (!newPreset) {
    alert('Skriv en melding for du lagrer preset.');
    return;
  }

  const existing = messageState.lines || [];
  const updated = [...existing, newPreset];

  socket.emit('messages:update', {
    title: titleInput.value.trim() || 'Beskjeder til svommere',
    lines: updated
  });
});

loadPresetBtn.addEventListener('click', () => {
  const presetText = selectedPresetText();
  if (!presetText) return;
  messageInput.value = presetText;
});

showPresetBtn.addEventListener('click', () => {
  const lines = messageState.lines || [];
  if (!lines.length) return;
  const selectedIndex = Number(presetSelect.value);
  if (selectedIndex < 0 || selectedIndex >= lines.length) return;
  publishText(lines[selectedIndex], selectedIndex);
});

showRandomBtn.addEventListener('click', () => {
  const lines = messageState.lines || [];
  if (!lines.length) return;
  const randomIndex = Math.floor(Math.random() * lines.length);
  publishText(lines[randomIndex], randomIndex);
});

deletePresetBtn.addEventListener('click', () => {
  const lines = messageState.lines || [];
  if (!lines.length) return;

  const selectedIndex = Number(presetSelect.value);
  if (selectedIndex < 0 || selectedIndex >= lines.length) return;

  const updated = lines.filter((_, index) => index !== selectedIndex);
  let nextIndex = selectedIndex;
  if (nextIndex >= updated.length) nextIndex = updated.length - 1;

  socket.emit('messages:update', {
    title: titleInput.value.trim() || 'Beskjeder til svommere',
    lines: updated,
    currentIndex: updated.length ? nextIndex : -1
  });
});

clearBtn.addEventListener('click', () => {
  socket.emit('messages:update', {
    title: titleInput.value.trim() || 'Beskjeder til svommere',
    blank: true,
    text: ''
  });
});

socket.on('messages:update', (nextState) => {
  messageState = {
    ...messageState,
    ...(nextState || {})
  };

  // Keep the typing field free for one-off edits unless it is empty.
  if (!messageInput.value.trim() && messageState.text) {
    messageInput.value = messageState.text;
  }

  renderState();
});

// Ensure title changes are reflected without needing another button click.
titleInput.addEventListener('change', () => {
  socket.emit('messages:update', {
    title: titleInput.value.trim() || 'Beskjeder til svommere'
  });
});