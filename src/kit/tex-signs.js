import * as THREE from 'three';
import {mulberry32, makeCanvas, TAU} from './util.js';

// Signage atlases. All brands, people and slogans are fictional (except the user's own landmark names): busts are faceless
// silhouettes and "party" posters use invented generic symbols (no real candidates or propaganda).
const ML = '"KeralaSign","Noto Sans Malayalam","Nirmala UI","Malayalam MN",Arial,sans-serif';
const EN = '"Arial Black","Impact","Helvetica Neue",Arial,sans-serif';
let fontsReady = false;

export async function loadFonts(base = 'assets/fonts/') {
  try {
    const faces = [['800', 'NotoSansMalayalam-800.woff2'], ['700', 'NotoSansMalayalam-700.woff2']].map(([w, f]) => new FontFace('KeralaSign', `url(${base}${f})`, {weight: w}));
    await Promise.all(faces.map(f => f.load())); faces.forEach(f => document.fonts.add(f)); fontsReady = true;
  } catch (e) { console.warn('Malayalam sign font unavailable, falling back to system fonts', e); }
  return fontsReady;
}

function fit(c, text, x, y, maxW, size, {font = EN, weight = 800, color = '#fff', align = 'center', stroke = null, min = 10} = {}) {
  let s = size; c.font = `${weight} ${s}px ${font}`;
  while (c.measureText(text).width > maxW && s > min) { s -= 2; c.font = `${weight} ${s}px ${font}`; }
  c.textAlign = align; c.textBaseline = 'middle';
  if (stroke) { c.lineWidth = Math.max(2, s / 9); c.strokeStyle = stroke; c.lineJoin = 'round'; c.strokeText(text, x, y); }
  c.fillStyle = color; c.fillText(text, x, y); return s;
}
const circle = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

/* ------------------------------------------------------------------ shop signs (512x128 each) */
const SIGNS = [
  ['hotel', 'HOTEL VASANTH', 'ഹോട്ടൽ', 'band', '#f6ecd2', '#b3201f', '#1d6b3a'], ['cafe', 'NILA CAFE', 'ചായ · കാപ്പി', 'dark', '#2a2623', '#ffffff', '#f06a22'],
  ['restaurant', 'KALYANI RESTAURANT', 'ഹോട്ടൽ', 'dark', '#33302d', '#ffffff', '#f06a22'], ['grill', 'MALABAR GRILL', 'ബിരിയാണി', 'dark', '#5a1414', '#ffe9b0', '#f2b134'],
  ['bakery', 'SAGAR BAKERY & COOL BAR', 'ബേക്കറി', 'band', '#fbfaf5', '#1f4aa8', '#d8302c'], ['juice', 'FRESH JUICE & SWEETS', 'ജ്യൂസ്', 'band', '#2d8a4a', '#ffffff', '#ffd23a'],
  ['tea1', 'TEA SHOP', 'ചായക്കട', 'band', '#2f6b3f', '#fff2c8', '#f2b134'], ['tea2', 'SREE KRISHNA TEA STALL', 'ചായക്കട', 'band', '#7a2a18', '#ffe7b8', '#f2b134'],
  ['tea3', 'HILL VIEW TEA SHOP', 'ചായക്കട', 'band', '#e8d9b0', '#4a2a14', '#2f6b3f'], ['super', 'KERALA SUPERMARKET', 'സൂപ്പർ മാർക്കറ്റ്', 'band', '#1f8a43', '#ffffff', '#ffd23a'],
  ['mart', 'FRESH MART', 'ഫ്രഷ് മാർട്ട്', 'band', '#e5352c', '#ffffff', '#ffe34a'], ['stores', 'BISMI STORES', 'പലചരക്ക്', 'band', '#f6e4a8', '#a02320', '#1f4aa8'],
  ['fish', 'FRESH FISH', 'മീൻ', 'band', '#1d5e9c', '#ffffff', '#ffe34a'], ['meat', 'FRESH MEAT', 'ഇറച്ചി', 'band', '#a41f26', '#ffffff', '#ffd9a0'],
  ['veg', 'VEGETABLES & FRUITS', 'പച്ചക്കറി', 'band', '#3b9a3f', '#ffffff', '#ffe34a'], ['medical', 'JYOTHI MEDICALS', 'മെഡിക്കൽസ്', 'cross', '#ffffff', '#1c8a55', '#1c8a55'],
  ['hardware', 'CITY HARDWARE & PAINTS', '', 'band', '#e46d1b', '#ffffff', '#222222'], ['mobile', 'MOBILE HUB · RECHARGE', 'മൊബൈൽ', 'band', '#1d56b8', '#ffffff', '#ffd23a'],
  ['textile', 'THARA TEXTILES', 'ടെക്സ്റ്റൈൽസ്', 'band', '#b3197a', '#ffffff', '#ffe08a'], ['jewel', 'SWARNA JEWELLERY', 'ജ്വല്ലറി', 'band', '#4a0f1a', '#f5c451', '#f5c451'],
  ['travels', 'CITY TRAVELS & TOURS', '', 'band', '#0f6e8c', '#ffffff', '#ffd23a'], ['bank', 'KERA BANK · ATM', '', 'band', '#12448a', '#ffffff', '#f2a900'],
  ['fuel', 'KERAFUEL PETROL PUMP', 'പെട്രോൾ പമ്പ്', 'band', '#d82424', '#ffffff', '#ffd23a'], ['workshop', 'NEW STAR WORKSHOP', 'വർക്ക്ഷോപ്പ്', 'band', '#2a2d33', '#ffd23a', '#ffffff'],
  ['clinic', 'SMILE DENTAL CLINIC', 'ക്ലിനിക്', 'cross', '#f2fbff', '#177ab0', '#177ab0'], ['optical', 'CLEAR VISION OPTICALS', '', 'band', '#12616b', '#ffffff', '#9ae6ef'],
  ['xerox', 'STATIONERY · XEROX', '', 'band', '#f2d23a', '#1f2a6b', '#d8302c'], ['tuition', 'DISHA TUITION CENTRE', 'ട്യൂഷൻ', 'band', '#1f3f98', '#ffffff', '#ffd23a'],
  ['welcome', 'WELCOME TO KURUKKANMOOLA', 'സ്വാഗതം', 'band', '#1f6b3f', '#ffffff', '#ffd23a'], ['busstand', 'BUS STAND', 'ബസ് സ്റ്റാൻഡ്', 'band', '#1a4f9c', '#ffffff', '#ffd23a'],
  ['school', 'GOVT. HIGHER SECONDARY SCHOOL', '', 'band', '#f1ecdc', '#1a3d7c', '#a02320'], ['college', 'KURUKKANMOOLA COLLEGE', '', 'band', '#1a2a4c', '#f5e6b0', '#f5c451'],
  // the user's own landmark names (kept so the in-game landmarks are recognisable) and the job-counter labels
  ['aryaas', 'HOTEL ARYAAS', 'ഹോട്ടൽ', 'dark', '#2b2623', '#ffffff', '#f06a22'], ['padma', 'PADMA CAFE', 'കഫേ', 'dark', '#3a2424', '#ffe9c8', '#f2a134'],
  ['calicut', 'CALICUT CHEF', 'RESTAURANT', 'band', '#d7351f', '#ffffff', '#ffd23a'], ['arabian', 'ARABIAN NIGHTS RESTAURANT', '', 'dark', '#2a2623', '#ffffff', '#f06a22'],
  ['nss', 'N.S.S. HINDU COLLEGE', '', 'band', '#1a2a4c', '#f5e6b0', '#f5c451'], ['kuru', 'KURUKKANMOOLA SUPERMARKET', 'സൂപ്പർ മാർക്കറ്റ്', 'band', '#1f8a43', '#ffffff', '#ffd23a'],
  ['kuttettan', 'KUTTETTAN STORES', 'പലചരക്ക്', 'band', '#f6e4a8', '#a02320', '#1f4aa8'], ['meatstall', 'SREE MEAT STALL', 'ഇറച്ചി', 'band', '#a41f26', '#ffffff', '#ffd9a0'],
  ['kadal', 'KADAL FISH MARKET', 'മീൻ', 'band', '#1d5e9c', '#ffffff', '#ffe34a'],
  ['jc_super', 'SUPERMARKET CHECKOUT', '', 'band', '#22312a', '#f1e6cc', '#ffd23a'], ['jc_meat', 'MEAT STALL COUNTER', '', 'band', '#22312a', '#f1e6cc', '#ffd23a'],
  ['jc_fish', 'FISH MARKET COUNTER', '', 'band', '#22312a', '#f1e6cc', '#ffd23a'], ['jc_store', 'GENERAL STORE COUNTER', '', 'band', '#22312a', '#f1e6cc', '#ffd23a'],
  ['jc_taxi', 'TAXI STAND', 'ടാക്സി', 'band', '#22312a', '#f1e6cc', '#ffd23a'], ['jc_bus', 'BUS DEPOT', 'ബസ് സ്റ്റാൻഡ്', 'band', '#22312a', '#f1e6cc', '#ffd23a'],
  ['resort', 'CHURULI RESORT', 'റിസോർട്ട്', 'dark', '#233a2c', '#f4ecd0', '#e8b23a'], ['teafactory', 'KANNADIKAL TEA FACTORY', 'ചായ', 'band', '#2f5a3a', '#ffffff', '#ffd23a'],
  ['glow', '', '', 'plain', '#ffffff', '#ffffff', '#ffffff'],
];

function paintSign(c, [id, en, ml, style, bg, fg, ac], x, y, w, h) {
  c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = ac; c.fillRect(0, 0, w, 7); c.fillRect(0, h - 7, w, 7);
  let cx = w / 2, tw = w - 36;
  if (style === 'dark') { circle(c, 52, h / 2, 34, ac); c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.moveTo(42, 40); c.lineTo(42, 88); c.moveTo(62, 40); c.lineTo(62, 88); c.moveTo(52, 40); c.lineTo(52, 66); c.stroke(); cx = 98 + (w - 98) / 2; tw = w - 118; }
  if (style === 'cross') { c.fillStyle = ac; c.fillRect(22, 40, 48, 16); c.fillRect(38, 24, 16, 48); cx = 80 + (w - 80) / 2; tw = w - 100; }
  if (style === 'plain') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.restore(); return; }
  const two = ml && ml.length > 0;
  fit(c, en, cx, two ? h * .40 : h * .52, tw, two ? 50 : 58, {color: fg, stroke: style === 'band' && bg.length === 7 && (fg === '#ffffff') ? 'rgba(0,0,0,.35)' : null});
  if (two) fit(c, ml, cx, h * .76, tw, 36, {font: ML, weight: 800, color: style === 'dark' ? ac : (fg === '#ffffff' ? ac : fg)});
  c.restore();
}

export function buildSignAtlas(renderer) {
  const W = 2048, H = 1664, cw = 512, ch = 128, canvas = makeCanvas(W, H), c = canvas.getContext('2d'), rects = {};
  c.fillStyle = '#333'; c.fillRect(0, 0, W, H);
  SIGNS.forEach((s, i) => { const col = i % 4, row = Math.floor(i / 4), x = col * cw, y = row * ch; paintSign(c, s, x, y, cw, ch); rects[s[0]] = [(x + 1) / W, 1 - (y + ch - 1) / H, (x + cw - 1) / W, 1 - (y + 1) / H]; });
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() || 4);
  return {map, rects, canvas, ids: SIGNS.map(s => s[0])};
}

/* ------------------------------------------------------------------ road signs (direction boards, name plates, shields, warnings) */
export function buildRoadSignAtlas(renderer) {
  const W = 1024, H = 1024, canvas = makeCanvas(W, H), c = canvas.getContext('2d'), rects = {}; let x = 0, y = 0, rowH = 0;
  c.fillStyle = '#222'; c.fillRect(0, 0, W, H);
  const put = (name, w, h, draw) => {
    if (x + w > W) { x = 0; y += rowH; rowH = 0; }
    c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip(); draw(c, w, h); c.restore();
    rects[name] = {rect: [(x + 1) / W, 1 - (y + h - 1) / H, (x + w - 1) / W, 1 - (y + 1) / H], aspect: h / w}; x += w; rowH = Math.max(rowH, h);
  };
  const arrow = (c, cx, cy, s, dir) => { c.save(); c.translate(cx, cy); c.rotate(dir); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .7, 0); c.lineTo(s * .25, 0); c.lineTo(s * .25, s); c.lineTo(-s * .25, s); c.lineTo(-s * .25, 0); c.lineTo(-s * .7, 0); c.closePath(); c.fill(); c.restore(); };
  const board = rows => (c, W, H) => {
    c.fillStyle = '#0e6b3e'; c.fillRect(0, 0, W, H); c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeRect(5, 5, W - 10, H - 10);
    rows.forEach(([txt, ml, dir], i) => { const cy = 40 + i * 74 + 22; arrow(c, 48, cy, 24, dir); fit(c, txt, 100, cy - (ml ? 10 : 0), W - 120, 40, {color: '#fff', align: 'left', weight: 700, font: '"Arial","Helvetica",sans-serif'}); if (ml) fit(c, ml, 100, cy + 24, W - 120, 26, {color: '#ffe', align: 'left', font: ML, weight: 700}); });
  };
  const U = 0, R = Math.PI / 2, L = -Math.PI / 2;
  put('dirTown', 384, 64 + 74 * 3, board([['Town Centre', 'ടൗൺ', U], ['Bus Stand', 'ബസ് സ്റ്റാൻഡ്', L], ['College', '', R]]));
  put('dirHill', 384, 64 + 74 * 3, board([['Hill Station', 'മല', U], ['Tea Estates', 'ചായത്തോട്ടം', R], ['Dam', 'ഡാം', L]]));
  put('dirBack', 384, 64 + 74 * 2, board([['Backwaters', 'കായൽ', U], ['Temple', 'ക്ഷേത്രം', R]]));
  put('dirHosp', 384, 64 + 74 * 2, board([['Hospital', 'ആശുപത്രി', L], ['Market', 'ചന്ത', U]]));
  const nameplate = (txt, ml) => (c, W, H) => { c.fillStyle = '#1b4fa8'; c.fillRect(0, 0, W, H); c.strokeStyle = '#fff'; c.lineWidth = 5; c.strokeRect(4, 4, W - 8, H - 8); fit(c, txt, W / 2, ml ? H * .38 : H / 2, W - 24, 46, {color: '#fff', font: '"Arial","Helvetica",sans-serif', weight: 700}); if (ml) fit(c, ml, W / 2, H * .74, W - 24, 28, {color: '#dfe9ff', font: ML, weight: 700}); };
  put('nameBazaar', 320, 100, nameplate('Bazaar Ring Rd', 'ബസാർ റോഡ്')); put('nameTown', 320, 100, nameplate('Town Street', 'ടൗൺ സ്ട്രീറ്റ്')); put('nameCollege', 320, 100, nameplate('College Rd', 'കോളേജ് റോഡ്')); put('nameMarket', 320, 100, nameplate('Market Rd', 'മാർക്കറ്റ് റോഡ്'));
  put('shield', 160, 160, (c, W, H) => { c.fillStyle = '#f4c20d'; rrect(c, 6, 6, W - 12, H - 12, 22); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 6; c.stroke(); fit(c, 'SH', W / 2, H * .3, W - 40, 40, {color: '#111'}); fit(c, '7', W / 2, H * .66, W - 40, 80, {color: '#111'}); });
  for (const sp of ['30', '50']) put('speed' + sp, 160, 160, (c, W, H) => { circle(c, W / 2, H / 2, 74, '#d8171f'); circle(c, W / 2, H / 2, 56, '#fff'); fit(c, sp, W / 2, H / 2, 80, 56, {color: '#111'}); });
  const tri = draw => (c, W, H) => { c.fillStyle = '#d8171f'; c.beginPath(); c.moveTo(W / 2, 8); c.lineTo(W - 8, H - 12); c.lineTo(8, H - 12); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(W / 2, 30); c.lineTo(W - 28, H - 24); c.lineTo(28, H - 24); c.closePath(); c.fill(); draw(c, W, H); };
  put('warnHump', 160, 150, tri((c, W, H) => { c.fillStyle = '#111'; c.beginPath(); c.arc(W / 2, H - 38, 30, Math.PI, 0); c.fill(); c.fillRect(W / 2 - 46, H - 40, 92, 8); }));
  put('warnSchool', 160, 150, tri((c, W, H) => { c.fillStyle = '#222'; circle(c, W / 2 - 14, H - 80, 12, '#222'); c.fillRect(W / 2 - 24, H - 66, 20, 30); circle(c, W / 2 + 18, H - 70, 9, '#222'); c.fillRect(W / 2 + 9, H - 60, 18, 24); }));
  put('warnTJunc', 160, 150, tri((c, W, H) => { c.fillStyle = '#111'; c.fillRect(W / 2 - 6, H - 70, 12, 46); c.fillRect(W / 2 - 34, H - 70, 68, 12); }));
  put('busStop', 128, 128, (c, W, H) => { c.fillStyle = '#1a56b0'; rrect(c, 4, 4, W - 8, H - 8, 18); c.fill(); c.fillStyle = '#fff'; rrect(c, 24, 26, W - 48, 50, 8); c.fill(); circle(c, 40, 88, 9, '#fff'); circle(c, W - 40, 88, 9, '#fff'); fit(c, 'BUS', W / 2, 98, W - 20, 20, {color: '#fff', min: 8}); });
  put('welcome', 512, 192, (c, W, H) => { c.fillStyle = '#1f6b3f'; c.fillRect(0, 0, W, H); c.strokeStyle = '#ffd23a'; c.lineWidth = 8; c.strokeRect(8, 8, W - 16, H - 16); fit(c, 'WELCOME TO', W / 2, 46, W - 60, 34, {color: '#ffe9a0'}); fit(c, 'KURUKKANMOOLA', W / 2, 100, W - 40, 64, {color: '#fff'}); fit(c, 'സ്വാഗതം', W / 2, 156, W - 60, 40, {font: ML, color: '#ffd23a'}); });
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() || 4);
  return {map, rects, canvas};
}

/* ------------------------------------------------------------------ posters & hoardings */
function bust(c, x, y, s, skin, shirt, hair = '#1a1410') {
  c.fillStyle = shirt; c.beginPath(); c.moveTo(x - s * 1.0, y + s * 1.5); c.quadraticCurveTo(x - s * 1.05, y + s * .45, x, y + s * .42); c.quadraticCurveTo(x + s * 1.05, y + s * .45, x + s * 1.0, y + s * 1.5); c.closePath(); c.fill();
  c.fillStyle = skin; c.fillRect(x - s * .16, y + s * .15, s * .32, s * .35); c.beginPath(); c.ellipse(x, y - s * .15, s * .38, s * .46, 0, 0, TAU); c.fill();
  c.fillStyle = hair; c.beginPath(); c.ellipse(x, y - s * .38, s * .4, s * .26, 0, Math.PI, TAU); c.fill();
  const g = c.createLinearGradient(x - s * .4, 0, x + s * .4, 0); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.1)'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y - s * .15, s * .38, s * .46, 0, 0, TAU); c.fill();
}
const SKINS = ['#c68a5e', '#a86b44', '#d9a37a', '#8a5636', '#b87a50'], SHIRTS = ['#f4f1ea', '#e8b23a', '#2f5fa8', '#c0392b', '#2e8b57', '#f08a3a', '#6a3d9a'];
const ICONS = {
  house: (c, x, y, s, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x, y - s * .9); c.lineTo(x + s, y); c.closePath(); c.fill(); c.fillRect(x - s * .75, y, s * 1.5, s * .9); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x - s * .15, y + s * .3, s * .3, s * .6); },
  book: (c, x, y, s, col) => { c.fillStyle = col; c.fillRect(x - s, y - s * .6, s * .95, s * 1.2); c.fillRect(x + s * .05, y - s * .6, s * .95, s * 1.2); c.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 4; i++) { c.fillRect(x - s * .85, y - s * .4 + i * s * .28, s * .7, 3); c.fillRect(x + s * .2, y - s * .4 + i * s * .28, s * .7, 3); } },
  phone: (c, x, y, s, col) => { c.fillStyle = col; rrect(c, x - s * .45, y - s * .9, s * .9, s * 1.8, s * .15); c.fill(); c.fillStyle = 'rgba(255,255,255,.85)'; rrect(c, x - s * .36, y - s * .74, s * .72, s * 1.3, s * .08); c.fill(); circle(c, x, y + s * .72, s * .08, 'rgba(255,255,255,.8)'); },
  lamp: (c, x, y, s, col) => { c.fillStyle = col; c.fillRect(x - s * .1, y - s * .2, s * .2, s * 1.1); c.beginPath(); c.moveTo(x - s * .7, y + s * .9); c.lineTo(x + s * .7, y + s * .9); c.lineTo(x + s * .4, y + s * .7); c.lineTo(x - s * .4, y + s * .7); c.fill(); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * s * .3, y - s * .2); c.lineTo(x + i * s * .3 - s * .08, y - s * .5); c.lineTo(x + i * s * .3 + s * .08, y - s * .5); c.fill(); circle(c, x + i * s * .3, y - s * .6, s * .12, '#ffe27a'); } },
  boat: (c, x, y, s, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x, y + s * .6, x + s, y); c.lineTo(x + s * .8, y - s * .1); c.lineTo(x - s * .8, y - s * .1); c.fill(); c.fillStyle = '#c28a3a'; c.beginPath(); c.moveTo(x - s * .5, y - s * .1); c.quadraticCurveTo(x, y - s * .9, x + s * .5, y - s * .1); c.fill(); },
  palm: (c, x, y, s, col) => { c.strokeStyle = '#6a4a2a'; c.lineWidth = s * .12; c.beginPath(); c.moveTo(x, y + s); c.quadraticCurveTo(x + s * .1, y, x + s * .05, y - s * .6); c.stroke(); c.strokeStyle = col; c.lineWidth = s * .09; for (let i = 0; i < 7; i++) { const a = -Math.PI * .95 + i * Math.PI * .32; c.beginPath(); c.moveTo(x + s * .05, y - s * .6); c.quadraticCurveTo(x + Math.cos(a) * s * .5, y - s * .6 + Math.sin(a) * s * .5 - s * .15, x + Math.cos(a) * s, y - s * .6 + Math.sin(a) * s * .55 + s * .25); c.stroke(); } },
  cup: (c, x, y, s, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - s * .7, y - s * .4); c.lineTo(x + s * .7, y - s * .4); c.lineTo(x + s * .5, y + s * .6); c.lineTo(x - s * .5, y + s * .6); c.fill(); c.strokeStyle = col; c.lineWidth = s * .12; c.beginPath(); c.arc(x + s * .75, y, s * .3, -1.2, 1.2); c.stroke(); },
  ring: (c, x, y, s, col) => { c.strokeStyle = col; c.lineWidth = s * .22; c.beginPath(); c.arc(x, y + s * .15, s * .7, 0, TAU); c.stroke(); circle(c, x, y - s * .62, s * .25, '#fff'); },
  star: (c, x, y, s, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .45 : s, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.fill(); },
  drop: (c, x, y, s, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x + s * .9, y + s * .1, x, y + s * .9); c.quadraticCurveTo(x - s * .9, y + s * .1, x, y - s); c.fill(); },
  flag: (c, x, y, s, col) => { c.fillStyle = '#4a3a2a'; c.fillRect(x - s * .8, y - s, s * .12, s * 2); c.fillStyle = col; c.beginPath(); c.moveTo(x - s * .68, y - s); c.lineTo(x + s * .9, y - s * .7); c.lineTo(x - s * .68, y - s * .1); c.fill(); circle(c, x - s * .2, y - s * .55, s * .16, '#fff'); },
};
const POSTER_DEFS = [
  ['movie', 'കടൽക്കര', 'ഈ ഓണത്തിന്', 'IN CINEMAS THIS ONAM', null, ['#1b1340', '#e8552a', '#ffcf5a', '#fff']], ['movie', 'മഴക്കാലം', 'നാളെ മുതൽ', 'NOW SHOWING', null, ['#0e2a3c', '#2c8aa0', '#f4e27a', '#fff']],
  ['movie', 'നാട്ടുവഴി', 'FAMILY ENTERTAINER', 'COMING SOON', null, ['#3b1030', '#d64a6a', '#ffd27a', '#fff']], ['movie', 'തീരം', 'BLOCKBUSTER', 'HOUSEFULL SHOWS', null, ['#10250f', '#5aa83a', '#f6e27a', '#fff']],
  ['movie', 'കായൽ', 'A CRIME THRILLER', 'RELEASING FRIDAY', null, ['#071a2a', '#1f6aa0', '#ff6a3a', '#fff']], ['movie', 'മലയോരം', 'ADVENTURE DRAMA', 'FROM DECEMBER', null, ['#2a1408', '#c8742a', '#ffe08a', '#fff']],
  ['event', 'ഉത്സവം', 'ANNUAL TEMPLE FESTIVAL', 'ALL ARE WELCOME', 'lamp', ['#7a1010', '#e8a020', '#fff0b0', '#fff6dc']], ['event', 'ONAM CELEBRATIONS', 'ഓണം', 'ARTS · GAMES · SADYA', 'palm', ['#f2d23a', '#e8561e', '#2f6b3f', '#2a1408']],
  ['event', 'FOOTBALL SEVENS', 'INTER-CLUB TOURNAMENT', 'CASH PRIZE ₹50,000', 'star', ['#0e5a2a', '#2f9a4a', '#ffe34a', '#fff']], ['event', 'BOOK FAIR', 'KURUKKANMOOLA LIBRARY', 'ENTRY FREE', 'book', ['#1f3f98', '#4a7ad8', '#ffd23a', '#fff']],
  ['event', 'BLOOD DONATION CAMP', 'SAVE A LIFE', 'SUNDAY 9 AM', 'drop', ['#8a1018', '#d83040', '#ffffff', '#fff']], ['event', 'FREE MEDICAL CAMP', 'ജനസേവനം', 'EYE · DENTAL · GENERAL', 'drop', ['#0f6a52', '#2fa07a', '#e6fff4', '#fff']],
  ['edu', 'ADMISSIONS OPEN', 'ട്യൂഷൻ', 'CLASSES 8 – 12 · ALL SUBJECTS', 'book', ['#16327a', '#3a64c8', '#ffd23a', '#fff']], ['edu', 'PSC COACHING', 'WEEKEND & REGULAR BATCHES', 'MOCK TESTS · NOTES', 'book', ['#5a1a6a', '#9a3ab0', '#ffe34a', '#fff']],
  ['edu', 'SPOKEN ENGLISH', 'IN 60 DAYS', 'ENROL TODAY', 'book', ['#0f5a6a', '#2a9ab0', '#fff2a0', '#fff']], ['edu', 'COMPUTER COURSES', 'DCA · TALLY · DTP', 'JOB ORIENTED', 'phone', ['#1a2a4c', '#3a5aa8', '#7be0ff', '#fff']],
  ['edu', 'ENTRANCE COACHING', 'NEET · JEE · CUSAT', 'SCHOLARSHIP TEST', 'star', ['#7a1a1a', '#d8402a', '#ffe08a', '#fff']], ['telecom', 'KERA NET 5G', 'UNLIMITED DATA ₹199', 'RECHARGE & WIN', 'phone', ['#d81f3a', '#ff5a6a', '#ffffff', '#fff']],
  ['telecom', 'RECHARGE', 'ALL NETWORKS · INSTANT', 'MOBILE HUB', 'phone', ['#1a56c8', '#3a8aff', '#ffe34a', '#fff']], ['estate', 'PLOTS FOR SALE', 'വിൽപ്പനയ്ക്ക്', 'CLEAR TITLE · ☎ 98XXX XXXXX', 'house', ['#1f6b3f', '#4aa860', '#fff2a0', '#fff']],
  ['estate', 'VILLAS READY', '3 BHK · GATED', 'BOOK NOW', 'house', ['#7a4a1a', '#c88a3a', '#fff0c0', '#fff']], ['estate', 'HOUSE FOR RENT', 'വാടകയ്ക്ക്', '☎ 98XXX XXXXX', 'house', ['#244a6a', '#4a8ab0', '#ffe27a', '#fff']],
  ['tourism', "GOD'S OWN COUNTRY", 'കേരളം', 'BACKWATERS · HILLS · BEACHES', 'palm', ['#0f6a8a', '#2fb0c8', '#fff2a0', '#fff']], ['tourism', 'HOUSEBOAT STAY', 'കായൽ', 'ALLEPPEY STYLE CRUISES', 'boat', ['#145a4a', '#2a9a7a', '#ffe08a', '#fff']],
  ['tourism', 'KURUKKANMOOLA FALLS', 'VISIT THE HILLS', 'TREKS · TEA TRAILS', 'drop', ['#1a4a3a', '#3a8a6a', '#e0fff0', '#fff']], ['sale', 'ONAM SALE', 'ഓണം ഓഫർ', 'UP TO 50% OFF', 'star', ['#e8321e', '#ff7a2a', '#ffe34a', '#fff']],
  ['sale', 'GRAND OPENING', 'ഉദ്ഘാടനം', 'OPENING OFFERS ALL WEEK', 'star', ['#6a1a8a', '#b04ad0', '#ffe34a', '#fff']], ['sale', 'GOLD LOAN', 'LOWEST INTEREST', 'INSTANT CASH', 'ring', ['#4a0f1a', '#8a2a3a', '#f5c451', '#fff']],
  ['sale', 'FURNITURE MART', 'TEAK · ROSEWOOD · STEEL', 'EMI AVAILABLE', 'house', ['#5a3a1a', '#a8743a', '#ffe9b8', '#fff']], ['sale', 'WEDDING HALL', 'AUDITORIUM · CATERING', 'BOOK YOUR DATE', 'lamp', ['#7a1a4a', '#d84a8a', '#ffe9a0', '#fff']],
  ['sale', 'FRESH TENDER COCONUT', 'കരിക്ക്', 'ONLY ₹30', 'palm', ['#2a7a3a', '#6ac060', '#fff2a0', '#fff']], ['sale', 'HILL TEA & SPICES', 'ചായ', 'FRESH FROM THE ESTATE', 'cup', ['#1f5a2a', '#4a9a4a', '#ffe9a0', '#fff']],
  ['political', 'VOTE FOR DEVELOPMENT', 'വികസനം', 'ROADS · WATER · JOBS', 'flag', ['#d8321e', '#f2a020', '#ffffff', '#fff']], ['political', 'PEOPLE FIRST', 'ജനസേവനം', 'YOUR VOICE · YOUR VOTE', 'flag', ['#1f5ac8', '#6aa0ff', '#ffe34a', '#fff']],
  ['political', 'GREEN FRONT', 'വോട്ട്', 'CLEAN · GREEN · KERALA', 'flag', ['#1f8a3a', '#6ad06a', '#ffffff', '#fff']], ['political', 'UNITED FORUM', 'വികസനം', 'PROGRESS FOR ALL', 'flag', ['#6a1ac8', '#a06aff', '#ffe34a', '#fff']],
];
function paintPoster(c, def, x, y, w, h, rnd, worn) {
  const [kind, head, sub, tag, icon, pal] = def, [p1, p2, ac, tx] = pal, isPol = kind === 'political', isMovie = kind === 'movie';
  c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  const g = c.createLinearGradient(0, 0, w * .7, h); g.addColorStop(0, p1); g.addColorStop(1, p2); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.globalAlpha = .18; c.fillStyle = ac; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(w / 2, h * .38); const a = i / 9 * TAU; c.lineTo(w / 2 + Math.cos(a) * w * 2, h * .38 + Math.sin(a) * w * 2); c.lineTo(w / 2 + Math.cos(a + .12) * w * 2, h * .38 + Math.sin(a + .12) * w * 2); c.fill(); } c.globalAlpha = 1;
  const heroH = h * .56;
  if (isMovie || isPol) { const n = isMovie ? rnd.pick([2, 3]) : rnd.pick([1, 3]); for (let i = 0; i < n; i++) { const bx = w * (n === 1 ? .5 : .22 + i * (.56 / (n - 1))), s = (n === 1 ? w * .3 : w * .2) * (i === (n - 1) / 2 && n === 3 ? 1.2 : 1); bust(c, bx, heroH * (.55 + (i % 2) * .05), s, rnd.pick(SKINS), isPol ? '#f4f1ea' : rnd.pick(SHIRTS)); } if (isPol) ICONS.flag(c, w * .84, heroH * .2, w * .12, ac); }
  else if (icon) { circle(c, w / 2, heroH * .52, w * .33, 'rgba(255,255,255,.2)'); (ICONS[icon] || ICONS.star)(c, w / 2, heroH * .52, w * .2, ac); }
  c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(0, heroH, w, h - heroH);
  const isML = /[\u0D00-\u0D7F]/.test(head);
  fit(c, head, w / 2, heroH + h * .09, w - 14, isML ? 34 : 30, {font: isML ? ML : EN, color: tx, stroke: 'rgba(0,0,0,.6)'});
  fit(c, sub, w / 2, heroH + h * .19, w - 16, 18, {font: /[\u0D00-\u0D7F]/.test(sub) ? ML : EN, color: ac, weight: 800, min: 8});
  c.fillStyle = ac; c.fillRect(0, h - h * .15, w, h * .15); fit(c, tag, w / 2, h - h * .075, w - 12, 15, {color: '#1a1410', min: 7});
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(0, 0, w, 4); c.fillRect(0, h - 3, w, 3);
  c.restore();
  if (worn) weather(c, x, y, w, h, rnd);
}
/** Sun-fade, water streaks and torn edges. Torn parts become transparent (the poster material uses alpha test). */
function weather(c, x, y, w, h, rnd) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.globalAlpha = rnd.range(.0, .45); c.fillStyle = '#e6dcc4'; c.fillRect(x, y, w, h); c.globalAlpha = 1;
  for (let i = 0; i < 5; i++) { const sx = x + rnd() * w, sh = rnd.range(h * .2, h * .8), gg = c.createLinearGradient(0, y, 0, y + sh); gg.addColorStop(0, 'rgba(90,70,50,.30)'); gg.addColorStop(1, 'rgba(90,70,50,0)'); c.fillStyle = gg; c.fillRect(sx, y, rnd.range(2, 6), sh); }
  if (rnd.chance(.5)) { c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 2; c.beginPath(); const fy = y + rnd.range(.2, .8) * h; c.moveTo(x, fy); c.lineTo(x + w, fy + rnd.range(-8, 8)); c.stroke(); }
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
  for (let i = 0, torn = rnd.int(1, 4); i < torn; i++) { const edge = rnd.int(0, 3), t = rnd(), sz = rnd.range(6, 22); c.beginPath(); const px = edge === 0 ? x + t * w : edge === 1 ? x + w : edge === 2 ? x + t * w : x, py = edge === 0 ? y : edge === 1 ? y + t * h : edge === 2 ? y + h : y + t * h; c.moveTo(px - sz, py - sz * .2); for (let k = 0; k < 7; k++) c.lineTo(px + rnd.range(-sz, sz), py + rnd.range(-sz, sz)); c.closePath(); c.fill(); }
  c.restore();
}
const BILLS = [
  ['telecom', 'KERA NET 5G', 'ഇനി വേഗം കൂടും', 'UNLIMITED PLANS FROM ₹199', 'phone', ['#d81f3a', '#ff6a5a', '#ffffff', '#fff']], ['jewel', 'SWARNA JEWELLERY', 'വിവാഹ ശേഖരം', 'WEDDING COLLECTION · PURE 916 HALLMARK', 'ring', ['#4a0f1a', '#9a2a3a', '#f5c451', '#fff']],
  ['textile', 'THARA TEXTILES', 'ഓണം ഓഫർ', 'ONAM COLLECTION · UP TO 40% OFF', 'star', ['#b3197a', '#ff6ab0', '#ffe08a', '#fff']], ['estate', 'SKYLINE VILLAS', 'സ്വപ്ന ഭവനം', 'GATED COMMUNITY · BOOK TODAY', 'house', ['#1f5a8a', '#4aa0d8', '#ffe27a', '#fff']],
  ['edu', 'DISHA COLLEGE', 'അഡ്മിഷൻ ആരംഭിച്ചു', 'ADMISSIONS OPEN · ARTS · SCIENCE', 'book', ['#16327a', '#4a7ad8', '#ffd23a', '#fff']], ['tourism', 'VISIT KURUKKANMOOLA', 'കേരളം', 'HILLS · BACKWATERS · TEA TRAILS', 'palm', ['#0f6a8a', '#2fb0c8', '#fff2a0', '#fff']],
  ['movie', 'മലയോരം', 'ഈ ഓണത്തിന്', 'IN CINEMAS THIS ONAM', null, ['#2a1408', '#c8742a', '#ffe08a', '#fff']], ['political', 'PEOPLE FIRST', 'വികസനം', 'ROADS · WATER · JOBS · YOUR VOTE', 'flag', ['#1f5ac8', '#6aa0ff', '#ffe34a', '#fff']],
  ['bank', 'KERA BANK', 'ഹോം ലോൺ', 'HOME LOANS FROM 8.5% · ☎ 1800-XXX-XXXX', 'house', ['#12448a', '#4a84d8', '#f2a900', '#fff']], ['health', 'CITY HOSPITAL', 'ജനസേവനം', '24 × 7 EMERGENCY · SPECIALITY CARE', 'drop', ['#0f6a52', '#3ab08a', '#e6fff4', '#fff']],
  ['tea', 'HILLCREST TEA', 'ചായ', 'FRESH FROM THE ESTATE', 'cup', ['#1f5a2a', '#4a9a4a', '#ffe9a0', '#fff']], ['sale', 'FURNITURE MART', 'TEAK · ROSEWOOD', 'GRAND OPENING OFFER', 'house', ['#5a3a1a', '#c88a3a', '#ffe9b8', '#fff']],
];
function paintBillboard(c, def, x, y, w, h, rnd) {
  const [kind, head, sub, tag, icon, [p1, p2, ac, tx]] = def;
  c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, p1); g.addColorStop(1, p2); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.globalAlpha = .16; c.fillStyle = ac; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(w * .22, h * .5); const a = i / 12 * TAU; c.lineTo(w * .22 + Math.cos(a) * w, h * .5 + Math.sin(a) * w); c.lineTo(w * .22 + Math.cos(a + .1) * w, h * .5 + Math.sin(a + .1) * w); c.fill(); } c.globalAlpha = 1;
  if (kind === 'movie' || kind === 'political') { for (let i = 0; i < 3; i++) bust(c, w * (.1 + i * .115), h * (.5 + (i === 1 ? -.04 : .02)), h * (i === 1 ? .3 : .24), rnd.pick(SKINS), kind === 'political' ? '#f4f1ea' : rnd.pick(SHIRTS)); }
  else { circle(c, w * .2, h * .5, h * .38, 'rgba(255,255,255,.22)'); (ICONS[icon] || ICONS.star)(c, w * .2, h * .5, h * .24, ac); }
  const isML = /[\u0D00-\u0D7F]/.test(head);
  fit(c, head, w * .66, h * .27, w * .6, isML ? 70 : 62, {font: isML ? ML : EN, color: tx, stroke: 'rgba(0,0,0,.55)'});
  fit(c, sub, w * .66, h * .52, w * .6, 44, {font: /[\u0D00-\u0D7F]/.test(sub) ? ML : EN, color: ac, stroke: 'rgba(0,0,0,.4)'});
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, h * .78, w, h * .22); fit(c, tag, w * .5, h * .89, w - 30, 26, {color: '#fff', min: 12});
  c.fillStyle = ac; c.fillRect(0, 0, w, 7); c.fillRect(0, h - 7, w, 7);
  c.restore();
}
export function buildPosterAtlas(renderer) {
  const W = 2048, H = 2048, canvas = makeCanvas(W, H), c = canvas.getContext('2d'), rnd = mulberry32(31337), rects = {}, list = [];
  c.clearRect(0, 0, W, H);
  const pw = 144, ph = 216; let x = 0, y = 0;
  const defs = []; POSTER_DEFS.forEach(d => { defs.push([d, false]); defs.push([d, true]); });
  defs.forEach(([def, worn], i) => { if (x + pw > W) { x = 0; y += ph; } const key = 'p' + i; paintPoster(c, def, x, y, pw, ph, rnd, worn); rects[key] = [(x + 1) / W, 1 - (y + ph - 1) / H, (x + pw - 1) / W, 1 - (y + 1) / H]; list.push({key, kind: def[0], worn, aspect: ph / pw}); x += pw; });
  y += ph; x = 0; const bw = 288, bh = 96;
  const strips = [['SALE', '#d8302c', '#fff'], ['OPEN', '#1f6b3f', '#fff'], ['ONAM OFFER', '#e8a020', '#2a1408'], ['TUITION', '#1f3f98', '#fff'], ['RECHARGE', '#d81f3a', '#fff'], ['FRESH FISH', '#1d5e9c', '#fff'], ['GOLD · SILVER', '#4a0f1a', '#f5c451'], ['MEDICALS', '#1c8a55', '#fff'], ['HOTEL', '#b3201f', '#fff'], ['LODGE', '#2a2d33', '#ffd23a'], ['SPECIAL OFFER', '#6a1a8a', '#ffe34a'], ['KERALA TOURISM', '#0f6a8a', '#fff']];
  for (let r = 0; r < 2; r++) for (const [t, bg, fg] of strips) {
    if (x + bw > W) { x = 0; y += bh; }
    c.fillStyle = bg; c.fillRect(x, y, bw, bh); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x, y, bw, 5); c.fillRect(x, y + bh - 5, bw, 5);
    fit(c, t, x + bw / 2, y + bh / 2, bw - 24, 44, {color: fg, stroke: 'rgba(0,0,0,.35)'}); if (r) weather(c, x, y, bw, bh, rnd);
    const key = 's' + list.length; rects[key] = [(x + 1) / W, 1 - (y + bh - 1) / H, (x + bw - 1) / W, 1 - (y + 1) / H]; list.push({key, kind: 'strip', worn: !!r, aspect: bh / bw}); x += bw;
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() || 4);
  const bc = makeCanvas(2048, 1024), b = bc.getContext('2d'), billboards = {}, bl = [];
  BILLS.forEach((def, i) => { const bx = (i % 4) * 512, by = Math.floor(i / 4) * 256; paintBillboard(b, def, bx, by, 512, 256, rnd); const key = 'b' + i; billboards[key] = [(bx + 1) / 2048, 1 - (by + 255) / 1024, (bx + 511) / 2048, 1 - (by + 1) / 1024]; bl.push(key); });
  const billMap = new THREE.CanvasTexture(bc); billMap.colorSpace = THREE.SRGBColorSpace; billMap.anisotropy = map.anisotropy;
  return {map, rects, list, canvas, billMap, billboards, billList: bl, billCanvas: bc, byKind: kind => list.filter(p => p.kind === kind)};
}
