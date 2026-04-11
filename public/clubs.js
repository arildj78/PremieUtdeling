'use strict';

const socket = io();

async function fetchClubSlides() {
  const response = await fetch('/api/clubs/slides');
  return response.json();
}

function formatClubCounter(index, total) {
  if (total === 0) return 'Ingen slides';
  return `Slide ${index + 1} / ${total}`;
}