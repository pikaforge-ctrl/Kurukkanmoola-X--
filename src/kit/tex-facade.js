import * as THREE from 'three';
import {mulberry32, makeCanvas, TAU} from './util.js';

// One 2048x2048 atlas (diffuse) + 1024x1024 half-res emissive twin. Every tile is 256x256 and covers one 3.2 m x 3.2 m "bay"
// of facade, so walls are built from repeated quads and a street of 3-storey shop houses is still one draw call.
// Window tiles exist twice (unlit / lit) so a few random windows glow at night without extra geometry or lights.
const T = 256, N = 8;

const rr = (d, x, y, w, h, r) => { d.beginPath(); d.roundRect ? d.roundRect(x, y, w, h, r) : d.rect(x, y, w, h); };
const plaster = (d, rnd, dirt = 0, streaks = true) => {
  d.fillStyle = '#f6f4ef'; d.fillRect(0, 0, T, T);
  for (let i = 0; i < 80; i++) { const r = rnd.range(8, 34); d.fillStyle = `rgba(${rnd.int(120, 160)},${rnd.int(110, 140)},${rnd.int(90, 120)},${rnd.range(.02, .06)})`; d.beginPath(); d.ellipse(rnd() * T, rnd() * T, r, r * rnd.range(.5, 1.4), rnd() * 3, 0, TAU); d.fill(); }
  if (streaks) for (let i = 0; i < 9; i++) { const x = rnd() * T, h = rnd.range(40, 150), w = rnd.range(2, 8), g = d.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(${rnd.chance(.5) ? '60,85,55' : '70,70,65'},.17)`); g.addColorStop(1, 'rgba(70,80,60,0)'); d.fillStyle = g; d.fillRect(x, 0, w, h); }
  if (dirt) { const g = d.createLinearGradient(0, T - dirt, 0, T); g.addColorStop(0, 'rgba(90,70,50,0)'); g.addColorStop(1, 'rgba(90,70,50,.32)'); d.fillStyle = g; d.fillRect(0, T - dirt, T, dirt); }
};
const glass = (d, x, y, w, h) => { const g = d.createLinearGradient(x, y, x + w * .5, y + h); g.addColorStop(0, '#9cc3cf'); g.addColorStop(.5, '#547f90'); g.addColorStop(1, '#2d4e5e'); d.fillStyle = g; d.fillRect(x, y, w, h); d.fillStyle = 'rgba(255,255,255,.20)'; d.beginPath(); d.moveTo(x, y + h * .6); d.lineTo(x + w * .55, y); d.lineTo(x + w * .85, y); d.lineTo(x, y + h * .95); d.fill(); };
const glow = (d, e, x, y, w, h, warm = '#ffc15e') => { const g = d.createLinearGradient(x, y, x, y + h); g.addColorStop(0, 'rgba(250,224,160,.82)'); g.addColorStop(1, 'rgba(240,190,110,.9)'); d.fillStyle = g; d.fillRect(x, y, w, h); d.fillStyle = 'rgba(180,120,70,.22)'; for (let i = 1; i < 5; i++) d.fillRect(x + w * i / 5 - 1, y, 2, h); e.fillStyle = warm; e.fillRect(x, y, w, h); };
const mullions = (d, x, y, w, h, nx, ny, t, col) => { d.fillStyle = col; for (let i = 1; i < nx; i++) d.fillRect(x + w * i / nx - t / 2, y, t, h); for (let j = 1; j < ny; j++) d.fillRect(x, y + h * j / ny - t / 2, w, t); };
const frame = (d, x, y, w, h, t, col, hi) => { d.fillStyle = col; d.fillRect(x - t, y - t, w + 2 * t, t); d.fillRect(x - t, y + h, w + 2 * t, t); d.fillRect(x - t, y, t, h); d.fillRect(x + w, y, t, h); d.fillStyle = hi; d.fillRect(x - t, y - t, w + 2 * t, 1.5); d.fillRect(x - t, y - t, 1.5, h + 2 * t); };
const sill = (d, x, y, w) => { d.fillStyle = '#d8d4cb'; d.fillRect(x - 10, y, w + 20, 9); d.fillStyle = 'rgba(0,0,0,.28)'; d.fillRect(x - 10, y + 9, w + 20, 5); };
const chajja = (d, x, y, w) => { d.fillStyle = '#e4e0d6'; d.fillRect(x - 14, y - 10, w + 28, 10); const g = d.createLinearGradient(0, y, 0, y + 24); g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(x - 6, y, w + 12, 24); };
const WOOD = ['#5a3a22', '#7a5230'], ALU = ['#9aa3a8', '#cfd6da'], WHITE = ['#e9e6de', '#ffffff'];

function windowTile(d, e, rnd, lit, o) {
  plaster(d, rnd, 0);
  const {x, y, w, h} = o, fr = o.fr || WOOD;
  if (o.sunshade) chajja(d, x, y, w);
  d.fillStyle = 'rgba(0,0,0,.30)'; d.fillRect(x - 3, y - 3, w + 6, h + 6);
  glass(d, x, y, w, h);
  if (lit) glow(d, e || d, x, y, w, h);
  mullions(d, x, y, w, h, o.mx || 2, o.my || 2, 5, fr[0]);
  frame(d, x, y, w, h, 7, fr[0], fr[1]);
  if (o.grill) { d.fillStyle = '#1e1e20'; for (let i = 1; i < 8; i++) d.fillRect(x + w * i / 8 - 1.5, y, 3, h); d.fillRect(x, y + h * .5 - 1.5, w, 3); }
  if (o.sill !== false) sill(d, x, y + h + 7, w);
  if (o.shutters) for (const s of [-1, 1]) { const sx = s < 0 ? x - 34 : x + w + 4; d.fillStyle = o.shutters; d.fillRect(sx, y - 6, 30, h + 12); d.fillStyle = 'rgba(0,0,0,.22)'; for (let j = 0; j < h / 9; j++) d.fillRect(sx + 2, y - 2 + j * 9, 26, 3); }
}

const P = {};
P.wall = (d, e, r) => plaster(d, r, 0);
P.wallDirt = (d, e, r) => plaster(d, r, 46);
P.winA = (d, e, r, lit) => windowTile(d, e, r, lit, {x: 80, y: 58, w: 96, h: 112, mx: 2, my: 2, sunshade: true});
P.winB = (d, e, r, lit) => windowTile(d, e, r, lit, {x: 44, y: 72, w: 168, h: 92, mx: 3, my: 1, fr: ALU, sill: true});
P.winC = (d, e, r, lit) => windowTile(d, e, r, lit, {x: 84, y: 56, w: 88, h: 120, mx: 2, my: 3, fr: WHITE, grill: true, sunshade: true});
P.winD = (d, e, r, lit) => { plaster(d, r, 0); const x = 70, y = 28, w = 116, h = 214; d.fillStyle = 'rgba(0,0,0,.3)'; d.fillRect(x - 3, y - 3, w + 6, h + 6); glass(d, x, y, w, h); if (lit) glow(d, e, x, y, w, h); mullions(d, x, y, w, h, 2, 4, 5, WOOD[0]); frame(d, x, y, w, h, 8, WOOD[0], WOOD[1]); d.fillStyle = '#d8d4cb'; d.fillRect(x - 14, y + h, w + 28, 12); };
P.winE = (d, e, r, lit) => { plaster(d, r, 0); d.fillStyle = '#e8e4da'; d.fillRect(0, 150, T, 14); d.fillStyle = 'rgba(0,0,0,.18)'; d.fillRect(0, 164, T, 8); windowTile(d, e, r, lit, {x: 22, y: 52, w: 212, h: 98, mx: 4, my: 1, fr: ALU, sill: false}); };
P.winF = (d, e, r, lit) => windowTile(d, e, r, lit, {x: 98, y: 52, w: 60, h: 124, mx: 1, my: 3, shutters: '#4f6b4a'});
P.doorA = (d, e, r) => {
  plaster(d, r, 50); const x = 62, y = 44, w = 132, h = 212;
  d.fillStyle = '#e4e0d6'; d.fillRect(x - 14, y - 14, w + 28, 14); d.fillStyle = 'rgba(0,0,0,.35)'; d.fillRect(x - 6, y, w + 12, h); d.fillStyle = '#4a2f1c'; d.fillRect(x, y, w, h);
  for (const i of [0, 1]) { const px = x + 6 + i * (w / 2); for (const [py, ph] of [[y + 8, 62], [y + 78, 62], [y + 148, 56]]) { d.fillStyle = '#6a4428'; d.fillRect(px, py, w / 2 - 12, ph); d.fillStyle = 'rgba(255,230,190,.12)'; d.fillRect(px, py, w / 2 - 12, 2); } }
  d.fillStyle = '#d9b24a'; d.beginPath(); d.arc(x + w / 2 - 10, y + 118, 4, 0, TAU); d.arc(x + w / 2 + 10, y + 118, 4, 0, TAU); d.fill(); d.fillStyle = '#c8c3b8'; d.fillRect(x - 18, 246, w + 36, 10);
};
P.blankAC = (d, e, r) => { plaster(d, r, 0); d.fillStyle = '#eceae6'; rr(d, 112, 64, 98, 38, 6); d.fill(); d.fillStyle = '#b9bcbd'; for (let i = 0; i < 5; i++) d.fillRect(120, 78 + i * 4, 82, 2); d.fillStyle = 'rgba(60,60,60,.5)'; d.fillRect(150, 102, 3, 70); d.fillStyle = 'rgba(70,90,60,.2)'; d.fillRect(120, 104, 14, 60); };
P.parapet = (d, e, r) => { plaster(d, r, 0); d.fillStyle = '#d2cec4'; d.fillRect(0, 0, T, 34); d.fillStyle = 'rgba(0,0,0,.28)'; d.fillRect(0, 34, T, 6); d.fillStyle = 'rgba(80,100,70,.18)'; for (let i = 0; i < 6; i++) d.fillRect(r() * T, 34, 5, r.range(20, 90)); };
P.cornice = (d) => { d.fillStyle = '#efece4'; d.fillRect(0, 0, T, T); d.fillStyle = '#dedad0'; d.fillRect(0, 70, T, 26); d.fillStyle = 'rgba(0,0,0,.25)'; d.fillRect(0, 96, T, 18); d.fillStyle = '#fff'; d.fillRect(0, 60, T, 10); };

const shopFrame = (d, r, bg) => { plaster(d, r, 40); d.fillStyle = 'rgba(0,0,0,.18)'; d.fillRect(0, 0, T, 22); d.fillStyle = bg; d.fillRect(14, 22, 228, 234); };
const shutterStrip = (d, y, h) => { d.fillStyle = '#7d868c'; d.fillRect(14, y, 228, h); d.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 0; i < h / 7; i++) d.fillRect(14, y + i * 7, 228, 2); d.fillStyle = 'rgba(255,255,255,.18)'; d.fillRect(14, y, 228, 2); };
P.shopRoll = (d, e, r) => { plaster(d, r, 40); d.fillStyle = r.pick(['#6f7e8a', '#8a5b4a', '#527063', '#7b6b8a']); d.fillRect(14, 24, 228, 232); d.fillStyle = 'rgba(0,0,0,.26)'; for (let i = 0; i < 33; i++) d.fillRect(14, 28 + i * 7, 228, 2); d.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 33; i++) d.fillRect(14, 26 + i * 7, 228, 1); d.fillStyle = '#222'; d.fillRect(120, 236, 16, 8); };
const goods = (d, e, r, kind) => {
  shopFrame(d, r, '#2b231b'); const g = d.createLinearGradient(0, 40, 0, 256); g.addColorStop(0, '#5a4630'); g.addColorStop(1, '#241c14'); d.fillStyle = g; d.fillRect(14, 40, 228, 216); e.fillStyle = '#6b4a22'; e.fillRect(14, 40, 228, 216);
  if (kind === 'packets') for (let row = 0; row < 4; row++) for (let i = 0; i < 11; i++) { d.fillStyle = r.pick(['#d83a2e', '#f2c230', '#2f7ac9', '#3da357', '#ef8a2a', '#f4efe2', '#a13aa8']); d.fillRect(20 + i * 20.5, 58 + row * 36, 16, 26); e.fillStyle = 'rgba(255,190,100,.7)'; e.fillRect(20 + i * 20.5, 58 + row * 36, 16, 26); }
  if (kind === 'veg') { for (let i = 0; i < 6; i++) { const c = r.pick(['#4c9a38', '#d9462e', '#e8a83a', '#7bbf4a', '#8a3b8c']); d.fillStyle = '#7a5532'; d.fillRect(22 + i * 36, 170, 32, 36); for (let k = 0; k < 14; k++) { d.fillStyle = c; d.beginPath(); d.arc(26 + i * 36 + r() * 24, 168 + r() * 10, 8, 0, TAU); d.fill(); } } d.fillStyle = '#c9d2a2'; d.fillRect(20, 60, 216, 6); for (let i = 0; i < 8; i++) { d.fillStyle = r.pick(['#4c9a38', '#d9a02e']); d.fillRect(26 + i * 27, 66, 10, 38); } e.fillStyle = 'rgba(255,220,150,.5)'; e.fillRect(14, 40, 228, 216); }
  if (kind === 'fish') { d.fillStyle = '#c8d3d8'; d.fillRect(18, 150, 220, 70); for (let i = 0; i < 14; i++) { d.fillStyle = r.pick(['#8fa5b3', '#b8c7d0', '#c25a4a']); d.beginPath(); d.ellipse(40 + (i % 7) * 28, 166 + Math.floor(i / 7) * 28, 13, 6, r.range(-.4, .4), 0, TAU); d.fill(); } d.fillStyle = 'rgba(180,230,255,.25)'; d.fillRect(18, 150, 220, 70); e.fillStyle = 'rgba(210,235,255,.65)'; e.fillRect(14, 40, 228, 216); }
  if (kind === 'meat') { d.fillStyle = '#d8d0c0'; d.fillRect(18, 56, 220, 6); for (let i = 0; i < 6; i++) { d.fillStyle = '#b8352c'; d.fillRect(30 + i * 36, 62, 14, 60 + r() * 22); d.fillStyle = '#e9b2a6'; d.fillRect(32 + i * 36, 66, 4, 40); } d.fillStyle = '#ede7da'; d.fillRect(18, 176, 220, 40); e.fillStyle = 'rgba(255,200,170,.6)'; e.fillRect(14, 40, 228, 216); }
  shutterStrip(d, 22, 22); d.fillStyle = '#6a4a2c'; d.fillRect(14, 216, 228, 40); d.fillStyle = 'rgba(255,255,255,.1)'; d.fillRect(14, 216, 228, 3);
};
P.goodsA = (d, e, r) => goods(d, e, r, 'packets'); P.goodsB = (d, e, r) => goods(d, e, r, 'veg'); P.goodsC = (d, e, r) => goods(d, e, r, 'fish'); P.goodsD = (d, e, r) => goods(d, e, r, 'meat');
const bigGlass = (d, e, r, tone, inside) => { plaster(d, r, 30); d.fillStyle = '#d9d6cd'; d.fillRect(10, 26, 236, 230); d.fillStyle = tone; d.fillRect(18, 34, 220, 216); glass(d, 18, 34, 220, 216); inside(d, e); d.fillStyle = 'rgba(255,255,255,.14)'; d.beginPath(); d.moveTo(18, 190); d.lineTo(120, 34); d.lineTo(170, 34); d.lineTo(18, 250); d.fill(); mullions(d, 18, 34, 220, 216, 3, 1, 5, '#cfd3d4'); d.fillStyle = '#8c9296'; d.fillRect(10, 226, 236, 30); };
P.glassSuper = (d, e, r) => bigGlass(d, e, r, '#406a7a', (d, e) => { d.fillStyle = 'rgba(255,240,205,.5)'; d.fillRect(18, 34, 220, 190); for (let s = 0; s < 3; s++) for (let i = 0; i < 12; i++) { d.fillStyle = r.pick(['#d83a2e', '#f2c230', '#2f7ac9', '#3da357', '#ef8a2a']); d.fillRect(24 + i * 18, 70 + s * 54, 13, 34); } e.fillStyle = 'rgba(255,238,200,.85)'; e.fillRect(18, 34, 220, 190); });
P.glassFood = (d, e, r) => bigGlass(d, e, r, '#5a4130', (d, e) => { d.fillStyle = 'rgba(255,196,112,.62)'; d.fillRect(18, 34, 220, 190); for (let i = 0; i < 4; i++) { d.fillStyle = 'rgba(70,40,25,.8)'; d.fillRect(34 + i * 52, 150, 38, 5); d.fillRect(46 + i * 52, 155, 5, 40); d.fillStyle = '#ffe9b0'; d.beginPath(); d.arc(52 + i * 52, 78, 9, 0, TAU); d.fill(); } e.fillStyle = 'rgba(255,190,100,.95)'; e.fillRect(18, 34, 220, 190); });
P.glassTextile = (d, e, r) => bigGlass(d, e, r, '#704060', (d, e) => { for (let i = 0; i < 9; i++) { d.fillStyle = r.pick(['#d8334a', '#2e6fd0', '#f0b72a', '#3aa36a', '#8a3cc2', '#f07a2a']); d.fillRect(24 + i * 24, 60 + (i % 2) * 20, 18, 120); d.fillStyle = 'rgba(255,255,255,.2)'; d.fillRect(24 + i * 24, 60 + (i % 2) * 20, 5, 120); } e.fillStyle = 'rgba(255,230,200,.7)'; e.fillRect(18, 34, 220, 190); });
P.glassMobile = (d, e, r) => bigGlass(d, e, r, '#355a8a', (d, e) => { d.fillStyle = 'rgba(210,235,255,.42)'; d.fillRect(18, 34, 220, 190); for (let i = 0; i < 8; i++) { d.fillStyle = '#16191d'; d.fillRect(28 + i * 26, 120 + (i % 3) * 10, 16, 30); d.fillStyle = '#6fc0ff'; d.fillRect(30 + i * 26, 123 + (i % 3) * 10, 12, 20); } e.fillStyle = 'rgba(190,225,255,.85)'; e.fillRect(18, 34, 220, 190); });
P.glassPharmacy = (d, e, r) => bigGlass(d, e, r, '#3c7a62', (d, e) => { d.fillStyle = 'rgba(235,255,245,.62)'; d.fillRect(18, 34, 220, 190); for (let s = 0; s < 3; s++) for (let i = 0; i < 14; i++) { d.fillStyle = r.pick(['#f4f4f4', '#2f9a62', '#d8d8d8', '#3a7ac9']); d.fillRect(24 + i * 15.5, 70 + s * 52, 11, 28); } d.fillStyle = '#1f9a58'; d.fillRect(106, 200, 44, 12); d.fillRect(122, 184, 12, 44); e.fillStyle = 'rgba(210,255,230,.85)'; e.fillRect(18, 34, 220, 190); });
P.glassHardware = (d, e, r) => bigGlass(d, e, r, '#4a4f55', (d, e) => { d.fillStyle = 'rgba(230,226,215,.4)'; d.fillRect(18, 34, 220, 190); for (let i = 0; i < 9; i++) { d.fillStyle = r.pick(['#d86a22', '#2c5aa0', '#8a8f94', '#c8c030']); d.fillRect(26 + i * 24, 70 + (i % 3) * 30, 16, 50); } d.fillStyle = '#9aa0a5'; for (let i = 0; i < 6; i++) d.fillRect(30, 150 + i * 8, 190, 3); e.fillStyle = 'rgba(255,240,200,.6)'; e.fillRect(18, 34, 220, 190); });
P.shopTea = (d, e, r) => {
  shopFrame(d, r, '#2a2018'); const g = d.createLinearGradient(0, 40, 0, 256); g.addColorStop(0, '#6a5030'); g.addColorStop(1, '#2a2016'); d.fillStyle = g; d.fillRect(14, 40, 228, 216); e.fillStyle = '#7a5226'; e.fillRect(14, 40, 228, 216);
  for (let i = 0; i < 4; i++) { d.strokeStyle = '#4a3a1a'; d.lineWidth = 2; d.beginPath(); d.moveTo(46 + i * 54, 40); d.lineTo(46 + i * 54, 56); d.stroke(); d.fillStyle = '#e6c83a'; for (let k = 0; k < 6; k++) { d.beginPath(); d.ellipse(46 + i * 54 + (k - 3) * 3.4, 74 + k % 2 * 6, 4, 15, .35 * (k - 3) / 3, 0, TAU); d.fill(); } }
  d.fillStyle = '#7a5632'; d.fillRect(14, 168, 228, 88); d.fillStyle = 'rgba(255,255,255,.12)'; d.fillRect(14, 168, 228, 3);
  for (let i = 0; i < 5; i++) { d.fillStyle = 'rgba(210,230,235,.6)'; d.beginPath(); d.arc(40 + i * 44, 148, 17, 0, TAU); d.fill(); d.fillStyle = r.pick(['#c9873a', '#d8a860', '#a8662a']); d.beginPath(); d.arc(40 + i * 44, 152, 12, 0, Math.PI); d.fill(); d.fillStyle = '#3a3a3a'; d.fillRect(32 + i * 44, 128, 16, 5); }
  d.fillStyle = '#9aa0a2'; d.beginPath(); d.arc(204, 110, 20, 0, TAU); d.fill(); d.fillRect(196, 80, 16, 14); e.fillStyle = 'rgba(255,205,120,.9)'; e.fillRect(14, 40, 228, 130);
};
P.shopBakery = (d, e, r) => bigGlass(d, e, r, '#7a5a30', (d, e) => { d.fillStyle = 'rgba(255,224,160,.7)'; d.fillRect(18, 34, 220, 190); for (let s = 0; s < 3; s++) for (let i = 0; i < 7; i++) { d.fillStyle = r.pick(['#d89a4a', '#b8702c', '#f0d28a', '#e9a0b0', '#c04a3a']); d.beginPath(); d.ellipse(40 + i * 28, 74 + s * 52, 11, 8, 0, 0, TAU); d.fill(); } e.fillStyle = 'rgba(255,214,140,.9)'; e.fillRect(18, 34, 220, 190); });
P.arcade = (d, e, r) => { plaster(d, r, 30); const g = d.createLinearGradient(0, 30, 0, T); g.addColorStop(0, '#4a4036'); g.addColorStop(1, '#1d1914'); d.fillStyle = g; d.fillRect(20, 30, 216, 226); d.fillStyle = '#8a7a66'; d.fillRect(20, 30, 216, 14); d.fillStyle = '#5a4630'; d.fillRect(100, 110, 56, 146); d.fillStyle = 'rgba(255,225,170,.4)'; d.fillRect(108, 118, 40, 130); };
P.plinth = (d, e, r) => { d.fillStyle = '#4b5057'; d.fillRect(0, 0, T, T); for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) { const ox = (y % 2) * 64, cc = r.range(.85, 1.15); d.fillStyle = `rgb(${72 * cc | 0},${78 * cc | 0},${86 * cc | 0})`; d.fillRect(x * 128 + ox - 128 + 3, y * 64 + 3, 122, 58); d.fillStyle = 'rgba(255,255,255,.07)'; d.fillRect(x * 128 + ox - 128 + 3, y * 64 + 3, 122, 3); } for (let i = 0; i < 260; i++) { d.fillStyle = r.chance(.5) ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)'; d.fillRect(r() * T, r() * T, 2, 2); } };
P.laterite = (d, e, r) => { d.fillStyle = '#8a4e2c'; d.fillRect(0, 0, T, T); for (let y = 0; y < 5; y++) { let x = -r() * 50; while (x < T) { const w = r.range(44, 78), cc = r.range(.8, 1.2); d.fillStyle = `rgb(${186 * cc | 0},${108 * cc | 0},${62 * cc | 0})`; d.fillRect(x + 2, y * 51 + 2, w - 4, 47); for (let k = 0; k < 14; k++) { d.fillStyle = 'rgba(90,40,20,.35)'; d.fillRect(x + r() * w, y * 51 + r() * 47, 2, 2); } x += w; } } };
P.rubble = (d, e, r) => { d.fillStyle = '#3f4440'; d.fillRect(0, 0, T, T); for (let i = 0; i < 70; i++) { const cc = r.range(.7, 1.25); d.fillStyle = `rgb(${120 * cc | 0},${122 * cc | 0},${116 * cc | 0})`; d.beginPath(); d.ellipse(r() * T, r() * T, r.range(14, 30), r.range(10, 20), r() * 3, 0, TAU); d.fill(); } for (let i = 0; i < 60; i++) { d.fillStyle = 'rgba(60,100,50,.25)'; d.beginPath(); d.arc(r() * T, r() * T, r.range(4, 12), 0, TAU); d.fill(); } };
P.brick = (d, e, r) => { d.fillStyle = '#c9bfae'; d.fillRect(0, 0, T, T); for (let y = 0; y < 12; y++) for (let x = -1; x < 6; x++) { const cc = r.range(.82, 1.15); d.fillStyle = `rgb(${168 * cc | 0},${82 * cc | 0},${56 * cc | 0})`; d.fillRect(x * 46 + (y % 2) * 23 + 2, y * 21.3 + 2, 42, 17.5); } };
P.concrete = (d, e, r) => { d.fillStyle = '#d3d2cb'; d.fillRect(0, 0, T, T); for (let i = 0; i < 90; i++) { d.fillStyle = `rgba(${r.int(100, 150)},${r.int(100, 140)},${r.int(90, 130)},${r.range(.03, .08)})`; d.beginPath(); d.ellipse(r() * T, r() * T, r.range(8, 30), r.range(6, 22), r() * 3, 0, TAU); d.fill(); } d.fillStyle = 'rgba(0,0,0,.14)'; d.fillRect(0, 126, T, 3); d.fillRect(126, 0, 3, T); for (let i = 0; i < 6; i++) { const x = r() * T, h = r.range(40, 140), g = d.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(60,80,50,.2)'); g.addColorStop(1, 'rgba(60,80,50,0)'); d.fillStyle = g; d.fillRect(x, 0, r.range(2, 6), h); } };
P.wallPanel = (d, e, r) => { plaster(d, r, 60); d.fillStyle = 'rgba(0,0,0,.14)'; d.fillRect(18, 22, 220, 4); d.fillRect(18, 22, 4, 190); d.fillStyle = 'rgba(255,255,255,.35)'; d.fillRect(18, 212, 220, 4); d.fillRect(234, 22, 4, 194); };
P.woodDark = (d, e, r) => { d.fillStyle = '#4a2f1b'; d.fillRect(0, 0, T, T); for (let i = 0; i < 8; i++) { const cc = r.range(.85, 1.2); d.fillStyle = `rgb(${86 * cc | 0},${54 * cc | 0},${32 * cc | 0})`; d.fillRect(i * 32 + 1, 0, 30, T); for (let k = 0; k < 6; k++) { d.fillStyle = 'rgba(30,15,5,.25)'; d.fillRect(i * 32 + r() * 28, r() * T, 1.5, r.range(20, 70)); } } };
P.woodLight = (d, e, r) => { d.fillStyle = '#8a6540'; d.fillRect(0, 0, T, T); for (let i = 0; i < 8; i++) { const cc = r.range(.88, 1.15); d.fillStyle = `rgb(${158 * cc | 0},${116 * cc | 0},${72 * cc | 0})`; d.fillRect(i * 32 + 1, 0, 30, T); for (let k = 0; k < 6; k++) { d.fillStyle = 'rgba(70,40,15,.22)'; d.fillRect(i * 32 + r() * 28, r() * T, 1.5, r.range(20, 70)); } } };
P.metal = (d, e, r) => { const g = d.createLinearGradient(0, 0, T, 0); g.addColorStop(0, '#8d9399'); g.addColorStop(.5, '#b4bac0'); g.addColorStop(1, '#868c92'); d.fillStyle = g; d.fillRect(0, 0, T, T); for (let i = 0; i < 40; i++) { d.fillStyle = 'rgba(0,0,0,.05)'; d.fillRect(r() * T, 0, 1.5, T); } };
P.glassDark = (d, e, r) => { glass(d, 0, 0, T, T); d.fillStyle = 'rgba(10,25,35,.35)'; d.fillRect(0, 0, T, T); mullions(d, 0, 0, T, T, 4, 4, 4, '#2a3a44'); };
P.tileFloor = (d, e, r) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { d.fillStyle = (x + y) % 2 ? '#c9a07a' : '#d8c3a2'; d.fillRect(x * 64, y * 64, 64, 64); d.strokeStyle = 'rgba(60,40,30,.35)'; d.strokeRect(x * 64 + .5, y * 64 + .5, 63, 63); } for (let i = 0; i < 120; i++) { d.fillStyle = 'rgba(70,50,30,.06)'; d.fillRect(r() * T, r() * T, r.range(3, 14), r.range(3, 14)); } };
P.thatch = (d, e, r) => { d.fillStyle = '#6a5230'; d.fillRect(0, 0, T, T); for (let i = 0; i < 700; i++) { const cc = r.range(.7, 1.3); d.strokeStyle = `rgba(${166 * cc | 0},${130 * cc | 0},${76 * cc | 0},.75)`; d.lineWidth = r.range(1, 2.4); const x = r() * T, y = r() * T; d.beginPath(); d.moveTo(x, y); d.lineTo(x + r.range(-3, 3), y + r.range(14, 34)); d.stroke(); } };
P.white = (d) => { d.fillStyle = '#fff'; d.fillRect(0, 0, T, T); };
P.gold = (d) => { const g = d.createLinearGradient(0, 0, T, T); g.addColorStop(0, '#fff0a0'); g.addColorStop(.35, '#e2ac2a'); g.addColorStop(.7, '#9a6a12'); g.addColorStop(1, '#f2c84a'); d.fillStyle = g; d.fillRect(0, 0, T, T); for (let i = 0; i < 8; i++) { d.fillStyle = 'rgba(255,255,255,.18)'; d.fillRect(i * 32, 0, 6, T); } };
P.stone = (d, e, r) => { d.fillStyle = '#a7a8a1'; d.fillRect(0, 0, T, T); for (let i = 0; i < 300; i++) { d.fillStyle = r.chance(.5) ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.09)'; d.fillRect(r() * T, r() * T, r.range(2, 6), r.range(2, 6)); } d.strokeStyle = 'rgba(0,0,0,.2)'; d.lineWidth = 2; d.strokeRect(1, 1, T - 2, T - 2); };
const tarp = (d, r, c1, c2) => { d.fillStyle = c1; d.fillRect(0, 0, T, T); for (let i = 0; i < 26; i++) { d.strokeStyle = r.chance(.5) ? 'rgba(255,255,255,.1)' : c2; d.lineWidth = r.range(1, 3); d.beginPath(); d.moveTo(r() * T, 0); d.lineTo(r() * T + r.range(-30, 30), T); d.stroke(); } };
P.tarpBlue = (d, e, r) => tarp(d, r, '#2b6cb0', 'rgba(0,0,40,.18)'); P.tarpOrange = (d, e, r) => tarp(d, r, '#e0762a', 'rgba(80,20,0,.18)');
const awn = (d, a, b) => { for (let i = 0; i < 8; i++) { d.fillStyle = i % 2 ? b : a; d.fillRect(i * 32, 0, 32, T); } const g = d.createLinearGradient(0, 0, 0, T); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.22)'); d.fillStyle = g; d.fillRect(0, 0, T, T); };
P.awnRW = d => awn(d, '#cf2e2e', '#f4efe6'); P.awnGW = d => awn(d, '#2f8a4a', '#f4efe6'); P.awnBW = d => awn(d, '#2b5fa8', '#f4efe6'); P.awnOY = d => awn(d, '#e9792a', '#f2cf3a');
P.gableJali = (d) => { d.fillStyle = '#2a1a0e'; d.fillRect(0, 0, T, T); d.fillStyle = '#6a4326'; for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { d.save(); d.translate(x * 43 + 21, y * 43 + 21); d.rotate(Math.PI / 4); d.fillRect(-13, -13, 26, 26); d.restore(); } d.fillStyle = '#2a1a0e'; for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { d.beginPath(); d.arc(x * 43 + 21, y * 43 + 21, 6, 0, TAU); d.fill(); } };
P.pillar = (d, e, r) => { d.fillStyle = '#6a3a1f'; d.fillRect(0, 0, T, T); for (const [y, h, c] of [[0, 30, '#8a5530'], [60, 14, '#4a2812'], [90, 40, '#7a4626'], [150, 14, '#4a2812'], [190, 30, '#8a5530'], [226, 30, '#5a3018']]) { d.fillStyle = c; d.fillRect(0, y, T, h); } for (let i = 0; i < 40; i++) { d.fillStyle = 'rgba(0,0,0,.12)'; d.fillRect(r() * T, 0, 1.5, T); } };
P.roofTin = (d, e, r) => { d.fillStyle = '#6a7882'; d.fillRect(0, 0, T, T); for (let i = 0; i < 16; i++) { d.fillStyle = i % 2 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.22)'; d.fillRect(i * 16, 0, 8, T); } for (let i = 0; i < 30; i++) { d.fillStyle = 'rgba(150,80,40,.18)'; d.beginPath(); d.arc(r() * T, r() * T, r.range(4, 14), 0, TAU); d.fill(); } };
P.railing = (d) => { d.clearRect(0, 0, T, T); d.fillStyle = '#f2f0ea'; d.fillRect(0, 28, T, 22); d.fillRect(0, 232, T, 24); for (let i = 0; i < 14; i++) d.fillRect(8 + i * 18, 50, 8, 182); d.fillStyle = 'rgba(0,0,0,.18)'; d.fillRect(0, 44, T, 6); };
P.gateBars = (d) => { d.clearRect(0, 0, T, T); d.fillStyle = '#17171a'; d.fillRect(0, 30, T, 12); d.fillRect(0, 214, T, 14); d.fillRect(0, 122, T, 8); for (let i = 0; i < 14; i++) { d.fillRect(8 + i * 18, 40, 7, 186); d.beginPath(); d.moveTo(8 + i * 18 - 2, 40); d.lineTo(11.5 + i * 18, 16); d.lineTo(15 + i * 18 + 2, 40); d.fill(); } };
P.mesh = (d) => { d.clearRect(0, 0, T, T); d.strokeStyle = '#59605c'; d.lineWidth = 3; for (let i = -T; i < T * 2; i += 20) { d.beginPath(); d.moveTo(i, 0); d.lineTo(i + T, T); d.stroke(); d.beginPath(); d.moveTo(i + T, 0); d.lineTo(i, T); d.stroke(); } d.fillStyle = '#3a3f3c'; d.fillRect(0, 0, T, 8); d.fillRect(0, T - 8, T, 8); };

const LIT = ['winA', 'winB', 'winC', 'winD', 'winE', 'winF'];

export function buildFacadeAtlas(renderer) {
  const S = T * N, dc = makeCanvas(S, S), ec = makeCanvas(S / 2, S / 2), d = dc.getContext('2d'), e = ec.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, S / 2, S / 2);
  const rects = {}; let slot = 0;
  const place = (name, fn, lit) => {
    const col = slot % N, row = Math.floor(slot / N); slot++;
    const r = mulberry32(slot * 7919 + 13);
    d.save(); d.translate(col * T, row * T); d.beginPath(); d.rect(0, 0, T, T); d.clip();
    e.save(); e.scale(.5, .5); e.translate(col * T, row * T); e.beginPath(); e.rect(0, 0, T, T); e.clip();
    fn(d, e, r, lit); d.restore(); e.restore();
    const inset = 2 / S; rects[name] = [col * T / S + inset, 1 - (row + 1) * T / S + inset, (col + 1) * T / S - inset, 1 - row * T / S - inset];
  };
  for (const k of Object.keys(P)) { if (LIT.includes(k)) { place(k, P[k], false); place(k + '_lit', P[k], true); } else place(k, P[k], false); }
  if (slot > N * N) throw new Error('facade atlas overflow: ' + slot);
  const map = new THREE.CanvasTexture(dc), emissiveMap = new THREE.CanvasTexture(ec);
  for (const t of [map, emissiveMap]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() || 4); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
  return {map, emissiveMap, rects, tileCount: slot, canvas: dc};
}

/** Hand-painted terracotta Mangalore roof tile (tileable) plus a matching tangent-space normal map. */
export function buildRoofTiles(renderer) {
  const S = 512, c = makeCanvas(S, S), h = makeCanvas(S, S), x = c.getContext('2d'), y = h.getContext('2d'), rnd = mulberry32(88);
  const rows = 8, cols = 8, th = S / rows, tw = S / cols;
  x.fillStyle = '#7a2e14'; x.fillRect(0, 0, S, S); y.fillStyle = '#000'; y.fillRect(0, 0, S, S);
  for (let r = rows - 1; r >= -1; r--) for (let k = 0; k < cols + 1; k++) {
    const ox = (r % 2 ? tw / 2 : 0) + k * tw - tw / 2, oy = r * th, v = rnd.range(.82, 1.18), moss = rnd.chance(.12) ? rnd.range(.1, .45) : 0;
    const col = `rgb(${Math.min(255, 196 * v) | 0},${Math.min(255, (92 + moss * 60) * v) | 0},${Math.min(255, (52 + moss * 25) * v) | 0})`;
    const g = x.createLinearGradient(0, oy, 0, oy + th * 1.35); g.addColorStop(0, 'rgba(60,20,8,.65)'); g.addColorStop(.18, col); g.addColorStop(1, `rgb(${Math.min(255, 224 * v) | 0},${Math.min(255, 118 * v) | 0},${Math.min(255, 70 * v) | 0})`);
    const wrap = px => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { x.save(); x.translate(dx, dy); y.save(); y.translate(dx, dy); px(); y.restore(); x.restore(); } };
    wrap(() => {
      x.fillStyle = g; x.beginPath(); x.moveTo(ox + 2, oy); x.lineTo(ox + tw - 2, oy); x.lineTo(ox + tw - 4, oy + th * 1.3); x.quadraticCurveTo(ox + tw / 2, oy + th * 1.45, ox + 4, oy + th * 1.3); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,200,150,.22)'; x.fillRect(ox + tw * .3, oy + 4, tw * .12, th * 1.1); x.fillStyle = 'rgba(40,10,5,.22)'; x.fillRect(ox + tw * .72, oy + 4, tw * .1, th * 1.1);
      y.fillStyle = '#fff'; y.globalAlpha = .55 + (r % 2) * .05; y.beginPath(); y.moveTo(ox + 2, oy); y.lineTo(ox + tw - 2, oy); y.lineTo(ox + tw - 4, oy + th * 1.3); y.quadraticCurveTo(ox + tw / 2, oy + th * 1.45, ox + 4, oy + th * 1.3); y.closePath(); y.fill(); y.globalAlpha = 1;
    });
  }
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${rnd.chance(.5) ? '40,70,30' : '30,20,15'},${rnd.range(.04, .12)})`; x.beginPath(); x.arc(rnd() * S, rnd() * S, rnd.range(2, 9), 0, TAU); x.fill(); }
  const hd = y.getImageData(0, 0, S, S).data, nm = makeCanvas(S, S), nx = nm.getContext('2d'), out = nx.createImageData(S, S), H = (i, j) => hd[(((j + S) % S) * S + ((i + S) % S)) * 4] / 255;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const dx = (H(i + 1, j) - H(i - 1, j)) * 3.2, dy = (H(i, j + 1) - H(i, j - 1)) * 3.2, l = Math.hypot(dx, dy, 1), p = (j * S + i) * 4; out.data[p] = (-dx / l * .5 + .5) * 255; out.data[p + 1] = (dy / l * .5 + .5) * 255; out.data[p + 2] = (1 / l * .5 + .5) * 255; out.data[p + 3] = 255; }
  nx.putImageData(out, 0, 0);
  const map = new THREE.CanvasTexture(c), normalMap = new THREE.CanvasTexture(nm);
  for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() || 4); }
  map.colorSpace = THREE.SRGBColorSpace;
  return {map, normalMap, metersPerTile: 1.6};
}
