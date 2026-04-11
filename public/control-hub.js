'use strict';

const tabs = Array.from(document.querySelectorAll('.tab'));
const frame = document.getElementById('tabFrame');
const openDisplayLink = document.getElementById('openDisplayLink');
const displayPath = document.getElementById('displayPath');

function activateTab(tab) {
  const target = tab.dataset.target;
  const display = tab.dataset.display;

  tabs.forEach((btn) => {
    const active = btn === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  frame.src = target;
  openDisplayLink.href = display;
  displayPath.textContent = display;
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab));
});