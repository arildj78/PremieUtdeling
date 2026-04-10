'use strict';
// parse-data.js
// Run from project root: node parse-data.js
// Reads the XML meet setup file and the RTF swimmer registration,
// then writes public/data/ceremonies.json with real clubs, swimmers, and ceremonies.

const fs   = require('fs');
const path = require('path');

const ROOT     = __dirname;
const XML_FILE = path.join(ROOT, 'swim meet setup', '20260410BodOSKZeekitLAMONord2026.xml');
const RTF_FILE = path.join(ROOT, 'swimmers', 'P\u00e5meld.rtf');   // Påmeld.rtf
const OUT_FILE = path.join(ROOT, 'public', 'data', 'ceremonies.json');

// ─── RTF decode ───────────────────────────────────────────────────────────────
function decodeRTF(buf) {
  let s = buf.toString('latin1');
  // 1. \'XX hex escapes → Unicode char (ISO-8859-1 compatible for Norwegian chars)
  s = s.replace(/\\\'([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  // 2. Structural control words first, order matters
  s = s.replace(/\\tab/g,  '\t');
  s = s.replace(/\\par\b/g, '\n');
  s = s.replace(/\\line\b/g, '\n');
  // 3. Remove all remaining RTF control words (backslash + letters + optional sign + digits)
  s = s.replace(/\\[a-zA-Z]+[-]?\d*/g, '');
  // 4. Remove stray backslashes before non-word chars (\~ \- \* etc.)
  s = s.replace(/\\\S/g, '');
  // 5. Remove group braces (keeps text content intact)
  s = s.replace(/[{}]/g, '');
  // 6. Collapse runs of spaces (but not tabs or newlines)
  s = s.replace(/[ ]+/g, ' ');
  return s;
}

// ─── XML helpers ──────────────────────────────────────────────────────────────
function xmlVal(block, tag) {
  const m = block.match(new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>'));
  return m ? m[1].trim() : '';
}

// ─── Clubs (sourced from logos directory) ────────────────────────────────────
const CLUB_NAMES = [
  'Alta SK', 'Bjerkvik SK', 'Bodo SK', 'Batsfjord SK', 'Drag SK',
  'Fauske SK', 'Finnsnes SK', 'Hammerfest SLK', 'Harstad SK', 'Karasjok SK',
  'Kirkenes SK', 'Kjollefjord SK', 'Lakselv SK', 'Meloy SK', 'Misvar IL',
  'Nordlysbyen SLK', 'Rana SK', 'Sandnesssjoen IL', 'Sortland SLK', 'Svalbard Turn',
  'Svolver IL', 'Tana SK', 'Tromso SK', 'Tverlandet IL', 'Vadso SK', 'Vardo SK'
];

// The REAL names (with Norwegian characters) as they appear in the RTF and logos folder
const CLUB_NAMES_PROPER = [
  'Alta SK', 'Bjerkvik SK', 'Bod\u00f8 SK', 'B\u00e5tsfjord SK', 'Drag SK',
  'Fauske SK', 'Finnsnes SK', 'Hammerfest SLK', 'Harstad SK', 'Karasjok SK',
  'Kirkenes SK', 'Kj\u00f8llefjord SK', 'Lakselv SK', 'Mel\u00f8y SK', 'Misv\u00e6r IL',
  'Nordlysbyen SLK', 'Rana SK', 'Sandnessj\u00f8en IL', 'Sortland SLK', 'Svalbard Turn',
  'Svolv\u00e6r IL', 'Tana SK', 'Troms\u00f8 SK', 'Tverlandet IL', 'Vads\u00f8 SK', 'Vard\u00f8 SK'
];

// Sort by length descending so longer names match before shorter substrings
const CLUB_SORTED = CLUB_NAMES_PROPER
  .map((name, i) => ({ name, ascii: CLUB_NAMES[i] }))
  .sort((a, b) => b.name.length - a.name.length);

function slugify(name) {
  return 'club-' + name
    .toLowerCase()
    .replace(/\u00f8/g, 'o')   // ø
    .replace(/\u00e5/g, 'a')   // å
    .replace(/\u00e6/g, 'ae')  // æ
    .replace(/\u00c5/g, 'a')   // Å
    .replace(/\u00c6/g, 'ae')  // Æ
    .replace(/\u00d8/g, 'O')   // Ø
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const clubs = CLUB_NAMES_PROPER.map(name => ({
  id: slugify(name),
  name,
  logoPath: '/logos/clubs/' + encodeURIComponent(name + '.png')
}));

const clubByName = {};
clubs.forEach(c => { clubByName[c.name] = c.id; });

// ─── Stroke mappings ──────────────────────────────────────────────────────────
const STROKE_FROM_XML = {
  BUTTERFLY:    'Butterfly',
  FREESTYLE:    'Fri',
  BREASTSTROKE: 'Bryst',
  BACKSTROKE:   'Rygg',
  INDIVIDUALMEDLEY: 'Medley',
  MEDLEY:       'Medley'
};

// Order matters: 'individuell medley' must come before 'medley'
const STROKE_NO_KEYWORDS = [
  { key: 'individuell medley', val: 'Medley' },
  { key: 'butterfly',          val: 'Butterfly' },
  { key: 'bryst',              val: 'Bryst' },
  { key: 'rygg',               val: 'Rygg' },
  { key: 'medley',             val: 'Medley' },
  { key: 'fri',                val: 'Fri' },
];

function strokeFromNO(desc) {
  const d = desc.toLowerCase();
  for (const { key, val } of STROKE_NO_KEYWORDS) {
    if (d.includes(key)) return val;
  }
  return null;
}

// ─── Parse XML ────────────────────────────────────────────────────────────────
const xmlBuf  = fs.readFileSync(XML_FILE);
const xmlText = xmlBuf.toString('latin1');

const eventBlocks = xmlText.split(/<Event ID=/);
const events = {};

for (let i = 1; i < eventBlocks.length; i++) {
  const b   = eventBlocks[i];
  const num = parseInt(xmlVal(b, 'EventNumber'), 10);
  if (isNaN(num)) continue;

  const sex      = xmlVal(b, 'Sex');                          // FEMALE | MALE
  const strXML   = xmlVal(b, 'Eventart');
  const stroke   = STROKE_FROM_XML[strXML] || strXML;
  const youngest = parseInt(xmlVal(b, 'Youngest'), 10);
  const oldest   = parseInt(xmlVal(b, 'Oldest'),   10);
  const dist     = parseInt(xmlVal(b, 'EventLength'), 10);
  const prize    = xmlVal(b, 'PrizeCeremony') === 'TRUE';
  const cText    = xmlVal(b, 'PrizeCeremonyText');
  const sesId    = parseInt(xmlVal(b, 'SesId'), 10);
  const isPara   = youngest !== oldest;                           // para spans all birth years

  events[num] = { num, sex, stroke, youngest, oldest, dist, isPara, prize, cText, sesId };
}

// ─── Build ceremonies ─────────────────────────────────────────────────────────
// A ceremony is triggered whenever PrizeCeremony=TRUE on the gutter (MALE) event.
// The preceding FEMALE event (num-1) covers the jenter half of the same ceremony.
const ceremonies = [];
let cidx = 1;

const eventList = Object.values(events).sort((a, b) => a.num - b.num);

for (const ev of eventList) {
  if (!ev.prize || ev.sex !== 'MALE') continue;

  const jenEv = events[ev.num - 1];
  const hasJen = jenEv
    && jenEv.sex    === 'FEMALE'
    && jenEv.stroke === ev.stroke
    && jenEv.youngest === ev.youngest
    && jenEv.oldest   === ev.oldest;

  const year      = ev.isPara ? null : ev.youngest;
  const yearLabel = ev.isPara ? 'Para' : String(ev.youngest);
  const title     = yearLabel + ' - ' + ev.dist + 'm ' + ev.stroke;

  const emptyMedal = () => ({
    goldSwimmerId: null, goldNameOverride: '',
    silverSwimmerId: null, silverNameOverride: '',
    bronzeSwimmerId: null, bronzeNameOverride: ''
  });

  ceremonies.push({
    id: 'cer-' + String(cidx).padStart(3, '0'),
    eventNumbers: hasJen ? [ev.num - 1, ev.num] : [ev.num],
    year,
    para: ev.isPara,
    stroke: ev.stroke,
    distance: ev.dist,
    title,
    ceremonyText: ev.cText,
    sesId: ev.sesId,
    completed: false,
    medalists: { jenter: emptyMedal(), gutter: emptyMedal() }
  });
  cidx++;
}

// ─── Parse RTF swimmers ───────────────────────────────────────────────────────
const rtfBuf  = fs.readFileSync(RTF_FILE);
const rtfText = decodeRTF(rtfBuf);
const lines   = rtfText.split('\n');

const swimmers = [];
let currentClub    = null;
let currentSwimmer = null;
let swIdx = 1;

function flushSwimmer() {
  if (currentSwimmer) { swimmers.push(currentSwimmer); currentSwimmer = null; }
}

for (let li = 0; li < lines.length; li++) {
  const rawLine = lines[li];
  const line    = rawLine.trim();
  if (!line) continue;

  // ── Club header detection ──────────────────────────────────────────────────
  // Club lines are short: close to the club name length, not embedded in field data
  let foundClub = null;
  for (const { name } of CLUB_SORTED) {
    if (line.includes(name) && line.length <= name.length + 12) {
      foundClub = name;
      break;
    }
  }
  if (foundClub) {
    flushSwimmer();
    currentClub = foundClub;
    continue;
  }

  if (!currentClub) continue;

  // ── Skip summary / statistics lines ───────────────────────────────────────
  if (/^(jenter|gutter|totalt|sum\b)/i.test(line)) continue;

  // ── Continuation event line (trimmed line starts with Øvelse) ─────────────
  // Original rawLine starts with \t\t (two tabs) but trim() removes them.
  if (line.startsWith('\u00d8velse') || line.startsWith('velse') ||
      rawLine.startsWith('\t\t') || rawLine.startsWith('  \t') || rawLine.startsWith('\t ')) {
    if (currentSwimmer) {
      const stroke = strokeFromNO(line);
      if (stroke && !currentSwimmer.events.includes(stroke)) {
        currentSwimmer.events.push(stroke);
      }
      if (/para/i.test(line)) currentSwimmer.para = true;
    }
    continue;
  }

  // ── Swimmer entry ──────────────────────────────────────────────────────────
  // Pattern: "YY\tName\tØvelse N. Xm stroke, sex - (para | født YYYY)"
  const m = line.match(
    /^(\d{2})\t\s*(.+?)\t\s*\u00d8velse\s+\d+\.\s+(\d+m\s+.+?),\s*(jenter|gutter)\s*[-\u2013]+\s*(para|f\S+\s*(\d{4}))/i
  );
  if (m) {
    flushSwimmer();
    const [, yr2, rawName, distStroke, sex, paraOrBorn, birthYearStr] = m;
    const isPara     = /^para/i.test(paraOrBorn);
    const birthYear  = birthYearStr ? parseInt(birthYearStr, 10) : (2000 + parseInt(yr2, 10));
    const stroke     = strokeFromNO(distStroke);

    currentSwimmer = {
      id:        'sw-' + String(swIdx).padStart(4, '0'),
      name:      rawName.trim().replace(/\s+/g, ' '),
      birthYear,
      sex:       sex.toLowerCase(),
      clubId:    clubByName[currentClub] || null,
      para:      isPara,
      events:    stroke ? [stroke] : []
    };
    swIdx++;
    continue;
  }
}
flushSwimmer();

// ─── Write output ─────────────────────────────────────────────────────────────
const output = { clubs, swimmers, ceremonies };
fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');

const paraCount = ceremonies.filter(c => c.para).length;
const regularCount = ceremonies.length - paraCount;
console.log(`Clubs: ${clubs.length}`);
console.log(`Swimmers: ${swimmers.length}`);
console.log(`Ceremonies: ${ceremonies.length}  (Para: ${paraCount}, Regular: ${regularCount})`);
console.log(`Written to: ${OUT_FILE}`);
