'use strict';

const socket = io();
const msgTitle = document.getElementById('msgTitle');
const msgText = document.getElementById('msgText');

function render(state) {
  const blank = !state || state.blank === true || !state.text;
  document.body.classList.toggle('msg-blank', blank);

  if (blank) {
    msgTitle.textContent = state?.title || 'Beskjeder til svommere';
    msgText.textContent = '';
    return;
  }

  msgTitle.textContent = state.title || 'Beskjeder til svommere';
  msgText.textContent = state.text || '';

  msgText.classList.remove('msg-reveal');
  void msgText.offsetWidth;
  msgText.classList.add('msg-reveal');
}

socket.on('messages:update', (state) => {
  render(state || {});
});