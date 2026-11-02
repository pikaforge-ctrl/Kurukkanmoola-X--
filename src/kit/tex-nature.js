import * as THREE from 'three';
import {mulberry32, makeCanvas, TAU} from './util.js';

/* ------------------------------------------------------------------ vegetation atlas (alpha cut-outs) */
const greens = ['#1f4d1e', '#2b6a26', '#3c8a2c', '#56a63a', '#7cbf48'];
const leaf = (c, x, y, rx, ry, rot, col, vein = true) => {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1; c.stroke();
  if (vein) { c.strokeStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.moveTo(-rx * .9, 0); c.lineTo(rx * .9, 0); c.stroke(); }
  c.restore();
};
function cluster(c, x, y, w, h, rnd, pal, {n = 150, rmax = .47, rx = [8, 14], ry = [3.5, 6], dots = null} = {}) {
  c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * rmax;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * R, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * (h / w), shade = Math.min(4, Math.floor((1 - d / R) * 2.4 + rnd() * 2.2));
    leaf(c, px, py, rnd.range(...rx) * (w / 256 + .35), rnd.range(...ry) * (w / 256 + .35), rnd() * TAU, pal[shade] || pal[pal.length - 1]);
  }
  if (dots) for (let i = 0; i < dots.n; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * .85; c.fillStyle = rnd.pick(dots.cols); c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * (h / w), rnd.range(2.2, 4.2) * (w / 128 + .3), 0, TAU); c.fill(); }
  c.restore();
}
function frondTex(c, x, y, w, h, rnd, base = '#2c6a24', tip = '#6cb53c') {
  c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  const mid = w / 2, N = 46;
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1), yy = h - 6 - t * (h - 14), len = (w / 2 - 2) * Math.sin(Math.PI * Math.min(1, t * .88 + .08)) ** .8 * (t > .93 ? .5 : 1);
    const g = c.createLinearGradient(0, yy, 0, yy - 18); g.addColorStop(0, base); g.addColorStop(1, tip); c.fillStyle = g;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(mid, yy); c.lineTo(mid + s * len, yy - len * .55 - rnd() * 3); c.lineTo(mid + s * len * .96, yy - len * .55 + 3); c.lineTo(mid, yy + 4); c.closePath(); c.fill(); }
  }
  c.strokeStyle = '#6a8a2a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(mid, h); c.lineTo(mid, 4); c.stroke();
  c.restore();
}
function bananaTex(c, x, y, w, h, rnd) {
  c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  const mid = w / 2; c.beginPath(); c.moveTo(mid, h - 2);
  for (let i = 0; i <= 24; i++) { const t = i / 24, hw = (w / 2 - 3) * Math.sin(Math.PI * Math.pow(t, .75)) ** .7; c.lineTo(mid + hw, h - 2 - t * (h - 8)); }
  for (let i = 24; i >= 0; i--) { const t = i / 24, hw = (w / 2 - 3) * Math.sin(Math.PI * Math.pow(t, .75)) ** .7; c.lineTo(mid - hw, h - 2 - t * (h - 8)); }
  c.closePath(); const g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#2f7a2a'); g.addColorStop(.6, '#58a838'); g.addColorStop(1, '#8cc84c'); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(20,60,10,.25)'; c.lineWidth = 1; for (let i = 0; i < 34; i++) { const yy = h - 10 - i * (h - 18) / 34; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(mid, yy); c.lineTo(mid + s * (w / 2 - 6), yy - 20); c.stroke(); } }
  c.strokeStyle = '#c8e090'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(mid, h - 2); c.lineTo(mid, 6); c.stroke();
  c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 9; i++) { const yy = rnd.range(h * .15, h * .85), s = rnd.sign(); c.lineWidth = rnd.range(1.5, 3); c.strokeStyle = '#000'; c.beginPath(); c.moveTo(mid + s * (w / 2 + 2), yy); c.lineTo(mid + s * rnd.range(10, 20), yy - rnd.range(14, 26)); c.stroke(); }
  c.restore();
}
function grassTex(c, x, y, w, h, rnd, cols = ['#3f7a2a', '#5aa038', '#7cc04a', '#a8d868']) {
  c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  for (let i = 0; i < 22; i++) { const bx = rnd.range(6, w - 6), bh = rnd.range(h * .45, h - 3), lean = rnd.range(-w * .24, w * .24), bw = rnd.range(3, 7); c.fillStyle = rnd.pick(cols); c.beginPath(); c.moveTo(bx - bw, h); c.quadraticCurveTo(bx + lean * .3, h - bh * .55, bx + lean, h - bh); c.quadraticCurveTo(bx + lean * .3 + bw * .4, h - bh * .5, bx + bw, h); c.closePath(); c.fill(); }
  c.restore();
}
function pineTex(c, x, y, w, h, rnd) {
  c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  for (let i = 0; i < 260; i++) { const a = rnd.range(Math.PI * .02, Math.PI * .98), d = rnd.range(w * .1, w * .5); c.strokeStyle = rnd.pick(['#1f4a22', '#2b6030', '#3a7a3c', '#4a8a46']); c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2, h * .12); c.lineTo(w / 2 + Math.cos(a) * d, h * .12 + Math.sin(a) * d * .55 + rnd() * 4); c.stroke(); c.beginPath(); c.moveTo(w / 2, h * .12); c.lineTo(w / 2 - Math.cos(a) * d, h * .12 + Math.sin(a) * d * .55); c.stroke(); }
  c.restore();
}
function barkTex(c, x, y, w, h, rnd, base, dark, rings = 0) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = base; c.fillRect(x, y, w, h);
  for (let i = 0; i < w * 1.6; i++) { c.fillStyle = dark; c.globalAlpha = rnd.range(.12, .4); c.fillRect(x + rnd() * w, y + rnd() * h, rnd.range(1, 2.4), rnd.range(8, 40)); } c.globalAlpha = 1;
  if (rings) for (let i = 0; i < rings; i++) { const yy = y + (i + .5) * h / rings; c.fillStyle = 'rgba(40,28,18,.5)'; c.fillRect(x, yy, w, 2.4); c.fillStyle = 'rgba(255,240,210,.14)'; c.fillRect(x, yy + 2.4, w, 1.6); }
  c.restore();
}

export function buildVegetationAtlas(renderer) {
  const S = 1024, canvas = makeCanvas(S, S), c = canvas.getContext('2d'), rnd = mulberry32(5150), rects = {};
  c.clearRect(0, 0, S, S);
  let x = 0, y = 0, rowH = 0;
  const pack = (name, w, h, fn) => { if (x + w > S) { x = 0; y += rowH; rowH = 0; } fn(c, x, y, w, h); rects[name] = [(x + 1) / S, 1 - (y + h - 1) / S, (x + w - 1) / S, 1 - (y + 1) / S]; x += w; rowH = Math.max(rowH, h); };
  pack('leafA', 256, 256, (c, X, Y, w, h) => cluster(c, X, Y, w, h, rnd, greens, {n: 120, rx: [11, 18], ry: [4.5, 7.5]}));
  pack('leafB', 256, 256, (c, X, Y, w, h) => cluster(c, X, Y, w, h, rnd, ['#163d1a', '#21501f', '#2f6a28', '#3f8434', '#5a9a3c'], {n: 110, rx: [12, 19], ry: [5, 8.5]}));
  pack('leafFlower', 256, 256, (c, X, Y, w, h) => cluster(c, X, Y, w, h, rnd, ['#2a6a24', '#3a8a2c', '#56a63a', '#6cb844', '#86c850'], {n: 100, rx: [10, 16], ry: [4, 6.5], dots: {n: 38, cols: ['#d8452e', '#e8603a', '#cc3a2a', '#e87a46']}}));
  pack('leafYellow', 256, 256, (c, X, Y, w, h) => cluster(c, X, Y, w, h, rnd, ['#2a6a24', '#3a8a2c', '#56a63a', '#6cb844', '#86c850'], {n: 100, rx: [10, 16], ry: [4, 6.5], dots: {n: 38, cols: ['#f0cc3a', '#f6dd5a', '#e8b02a']}}));
  pack('pine', 256, 128, (c, X, Y, w, h) => pineTex(c, X, Y, w, h, rnd));
  pack('banana', 128, 256, (c, X, Y, w, h) => bananaTex(c, X, Y, w, h, rnd));
  pack('frond', 64, 256, (c, X, Y, w, h) => frondTex(c, X, Y, w, h, rnd));
  pack('fern', 64, 256, (c, X, Y, w, h) => frondTex(c, X, Y, w, h, rnd, '#2f7a2a', '#8ed054'));
  pack('barkPalm', 64, 256, (c, X, Y, w, h) => barkTex(c, X, Y, w, h, rnd, '#8a7a62', '#3a2e22', 22));
  const bush = dots => (c, X, Y, w, h) => cluster(c, X, Y, w, h, rnd, greens, {n: 60, rx: [9, 14], ry: [3.5, 5.5], dots});
  pack('bushRed', 128, 128, bush({n: 12, cols: ['#d83a30', '#e84e3c', '#c42a30']})); pack('bushPink', 128, 128, bush({n: 12, cols: ['#e8689e', '#f58cb8', '#f0f0ee']})); pack('bushYellow', 128, 128, bush({n: 12, cols: ['#f2c83a', '#f6dc5a', '#f0961f']}));
  pack('bush', 128, 128, (c, X, Y, w, h) => cluster(c, X, Y, w, h, rnd, greens, {n: 55, rx: [9, 14], ry: [3.5, 5.5]}));
  pack('grass', 128, 128, (c, X, Y, w, h) => grassTex(c, X, Y, w, h, rnd));
  pack('reed', 128, 128, (c, X, Y, w, h) => grassTex(c, X, Y, w, h, rnd, ['#6a7a30', '#8a9a3c', '#a8b24a', '#c8c060']));
  pack('bamboo', 128, 128, (c, X, Y, w, h) => cluster(c, X, Y, w, h, rnd, ['#3a7a2a', '#56962e', '#74b43a', '#98cc4a', '#b8dc62'], {n: 90, rx: [10, 16], ry: [1.8, 3]}));
  pack('barkBrown', 64, 64, (c, X, Y, w, h) => barkTex(c, X, Y, w, h, rnd, '#5a4430', '#201408'));
  pack('barkGrey', 64, 64, (c, X, Y, w, h) => barkTex(c, X, Y, w, h, rnd, '#8c8a82', '#3a3834'));
  pack('solid', 16, 16, (c, X, Y, w, h) => { c.fillStyle = '#fff'; c.fillRect(X, Y, w, h); });
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() || 4);
  return {map, rects, canvas, used: y + rowH};
}

/* ------------------------------------------------------------------ water: tileable ripple normal map + separate foam pattern */
export function buildWaterTextures(renderer) {
  const S = 256, rnd = mulberry32(777), H = new Float32Array(S * S), F = new Float32Array(S * S), waves = [];
  for (let i = 0; i < 14; i++) { const fx = rnd.int(-6, 6) || 1, fy = rnd.int(-6, 6) || 2; waves.push({fx, fy, a: rnd.range(.4, 1) / Math.hypot(fx, fy), p: rnd() * TAU, p2: rnd() * TAU}); }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let h = 0, f = 0; const u = i / S * TAU, v = j / S * TAU; for (const w of waves) { h += w.a * Math.sin(w.fx * u + w.fy * v + w.p); f += Math.sin(w.fx * 2 * u + w.fy * 2 * v + w.p2); } H[j * S + i] = h; F[j * S + i] = 1 - Math.abs(Math.sin(f * .55 + h * .6)); }
  const nc = makeCanvas(S, S), n = nc.getContext('2d'), out = n.createImageData(S, S), fc = makeCanvas(S, S), fx = fc.getContext('2d'), fout = fx.createImageData(S, S);
  const g = (i, j) => H[((j + S) % S) * S + ((i + S) % S)];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = (g(i + 1, j) - g(i - 1, j)) * 2.4, dy = (g(i, j + 1) - g(i, j - 1)) * 2.4, l = Math.hypot(dx, dy, 1), p = (j * S + i) * 4;
    out.data[p] = (-dx / l * .5 + .5) * 255; out.data[p + 1] = (-dy / l * .5 + .5) * 255; out.data[p + 2] = (1 / l * .5 + .5) * 255; out.data[p + 3] = 255;
    const f = Math.max(0, Math.min(255, (F[j * S + i] - .5) * 3.6 * 255)); fout.data[p] = fout.data[p + 1] = fout.data[p + 2] = f; fout.data[p + 3] = 255;
  }
  n.putImageData(out, 0, 0); fx.putImageData(fout, 0, 0);
  const aniso = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() || 4), normal = new THREE.CanvasTexture(nc), foam = new THREE.CanvasTexture(fc);
  for (const t of [normal, foam]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
  return {normal, foam};
}

/** Worn road paint: alpha chips so markings look sun-bleached rather than vector-clean. */
export function buildPaintWear() {
  const S = 128, c = makeCanvas(S, S), x = c.getContext('2d'), rnd = mulberry32(99);
  x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 110; i++) { x.fillStyle = `rgba(0,0,0,${rnd.range(.5, 1)})`; x.beginPath(); x.ellipse(rnd() * S, rnd() * S, rnd.range(.8, 3.6), rnd.range(.6, 2.2), rnd() * 3, 0, TAU); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
