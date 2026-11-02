import * as THREE from 'three';
import {mulberry32, TAU} from './util.js';

/* ====================================================================================================
 * Geometry builder: cards (alpha-cut quads), ribbons (fronds/leaves), tubes (trunks) with vertex colours.
 * Everything uses ONE material (vegetation atlas + vertex colours + alpha test + wind) so all species batch.
 * ==================================================================================================== */
class PB {
  constructor(rects) { this.R = rects; this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, v, c) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(c[0], c[1], c[2]); return this.p.length / 3 - 1; }
  card(cx, cy, cz, U, V, w, h, rect, col, nrm) {
    const hw = w / 2, hh = h / 2; let nx = U[1] * V[2] - U[2] * V[1], ny = U[2] * V[0] - U[0] * V[2], nz = U[0] * V[1] - U[1] * V[0]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nrm) { nx = nrm[0]; ny = nrm[1]; nz = nrm[2]; }
    const P = (a, b) => [cx + U[0] * a * hw + V[0] * b * hh, cy + U[1] * a * hw + V[1] * b * hh, cz + U[2] * a * hw + V[2] * b * hh];
    const q = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], uvs = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]];
    const b = this.p.length / 3; q.forEach((p, k) => this.v(p[0], p[1], p[2], nx, ny, nz, uvs[k][0], uvs[k][1], col)); this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  ribbon(pts, wFn, rect, colFn, sideHint = [0, 1, 0]) {
    const n = pts.length, b0 = this.p.length / 3;
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const d = sideHint[0] * tx + sideHint[1] * ty + sideHint[2] * tz; let sx = sideHint[0] - tx * d, sy = sideHint[1] - ty * d, sz = sideHint[2] - tz * d; const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      let nx = ty * sz - tz * sy, ny = tz * sx - tx * sz, nz = tx * sy - ty * sx; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const t = k / (n - 1), hw = wFn(t) / 2, c = typeof colFn === 'function' ? colFn(t) : colFn, v = rect[1] + (rect[3] - rect[1]) * t, p = pts[k];
      this.v(p[0] - sx * hw, p[1] - sy * hw, p[2] - sz * hw, nx, ny, nz, rect[0], v, c); this.v(p[0] + sx * hw, p[1] + sy * hw, p[2] + sz * hw, nx, ny, nz, rect[2], v, c);
    }
    for (let k = 0; k < n - 1; k++) { const a = b0 + k * 2; this.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  tube(pts, rFn, sides, rect, colFn) {
    const n = pts.length, b0 = this.p.length / 3;
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let ux = 1, uy = 0, uz = 0; if (Math.abs(tx) > .9) { ux = 0; uz = 1; } let vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux; const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
      ux = vy * tz - vz * ty; uy = vz * tx - vx * tz; uz = vx * ty - vy * tx;
      const r = rFn(k / (n - 1)), c = typeof colFn === 'function' ? colFn(k / (n - 1)) : colFn, p = pts[k], vv = rect[1] + (rect[3] - rect[1]) * (k / (n - 1));
      for (let s = 0; s <= sides; s++) { const a2 = s / sides * TAU, ca = Math.cos(a2), sa = Math.sin(a2), nx = ux * ca + vx * sa, ny = uy * ca + vy * sa, nz = uz * ca + vz * sa; this.v(p[0] + nx * r, p[1] + ny * r, p[2] + nz * r, nx, ny, nz, rect[0] + (rect[2] - rect[0]) * s / sides, vv, c); }
    }
    const row = sides + 1; for (let k = 0; k < n - 1; k++) for (let s = 0; s < sides; s++) { const a = b0 + k * row + s, b = a + 1, c = a + row, d = c + 1; this.i.push(a, b, c, b, d, c); }
  }
  blob(cx, cy, cz, rx, ry, rz, rect, col, seg = 6) {
    const b0 = this.p.length / 3, rings = 4;
    for (let r = 0; r <= rings; r++) { const th = r / rings * Math.PI, y = Math.cos(th), rr = Math.sin(th); for (let s = 0; s <= seg; s++) { const a = s / seg * TAU, nx = Math.cos(a) * rr, nz = Math.sin(a) * rr; this.v(cx + nx * rx, cy + y * ry, cz + nz * rz, nx, y, nz, rect[0], rect[1], col); } }
    for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = b0 + r * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1; this.i.push(a, c, b, b, c, d); }
  }
  /** Puffy crown: cards tangent to a (squashed) sphere, all with outward "spherical" normals. */
  crown(cx, cy, cz, R, count, rect, base, rnd, {squash = 1, size = 1.25, dark = .74} = {}) {
    for (let k = 0; k < count; k++) {
      const y = 1 - (k + .5) / count * 1.65, rad = Math.sqrt(Math.max(0, 1 - y * y)), a = k * 2.399963 + rnd() * .5, dx = Math.cos(a) * rad, dz = Math.sin(a) * rad, dy = y;
      const rr = R * (.55 + rnd() * .3), px = cx + dx * rr, py = cy + dy * rr * squash, pz = cz + dz * rr;
      let U = [-dz, 0, dx]; const ul = Math.hypot(...U) || 1; U = [U[0] / ul, 0, U[2] / ul];
      const V = [-dy * dx, rad * rad, -dy * dz], vl = Math.hypot(...V) || 1, Vn = [V[0] / vl, V[1] / vl, V[2] / vl];
      const roll = rnd() * TAU, c = Math.cos(roll), s = Math.sin(roll), U2 = [U[0] * c + Vn[0] * s, U[1] * c + Vn[1] * s, U[2] * c + Vn[2] * s], V2 = [-U[0] * s + Vn[0] * c, -U[1] * s + Vn[1] * c, -U[2] * s + Vn[2] * c];
      const shade = dark + (1 - dark) * (dy * .5 + .5) + (rnd() - .5) * .07, col = [base[0] * shade, base[1] * shade, base[2] * shade], sz = R * size * (.85 + rnd() * .35);
      this.card(px, py, pz, U2, V2, sz, sz, rect, col, [dx * .8, dy * .6 + .25, dz * .8]);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setIndex(this.i); g.computeBoundingSphere(); return g;
  }
}
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const curve = (n, f) => Array.from({length: n + 1}, (_, k) => f(k / n));
function frond(pb, base, az, pitch0, droop, len, width, rect, col, segs, roll = .3) {
  const pts = []; let [x, y, z] = base;
  for (let k = 0; k <= segs; k++) { pts.push([x, y, z]); const th = pitch0 - droop * Math.pow(k / segs, 1.5), dl = len / segs; x += Math.cos(az) * Math.cos(th) * dl; y += Math.sin(th) * dl; z += Math.sin(az) * Math.cos(th) * dl; }
  pb.ribbon(pts, t => width * (.55 + .45 * Math.sin(Math.min(1, t * 1.2 + .1) * Math.PI * .85)), rect, t => mul(col, .8 + .35 * t), [-Math.sin(az), roll, Math.cos(az)]);
}
function trunkPts(H, lean, bend, n = 6) { return curve(n, t => [lean[0] * t * t + bend[0] * Math.sin(t * Math.PI) * .4, H * t, lean[1] * t * t + bend[1] * Math.sin(t * Math.PI) * .4]); }

function crownTree(R, lod, rnd, o) {
  const pb = new PB(R), lean = o.lean || [rnd.range(-.5, .5), rnd.range(-.5, .5)], pts = trunkPts(o.trunkH, lean, [0, 0], lod ? 2 : 4);
  pb.tube(pts, t => o.trunkR * (1 - .3 * t) + (o.buttress && t < .15 ? o.trunkR * .6 * (1 - t / .15) : 0), lod ? 4 : 7, o.bark, t => [.7 + .2 * t, .65 + .2 * t, .55 + .15 * t]);
  const top = pts[pts.length - 1], cy = o.crownY, cx = top[0], cz = top[2];
  if (!lod && !o.noBranch) for (let b = 0; b < 3; b++) { const a = b / 3 * TAU + rnd() * 1; pb.tube(curve(3, t => [cx + Math.cos(a) * o.crownR * .45 * t, top[1] + (cy - top[1]) * t * .8, cz + Math.sin(a) * o.crownR * .45 * t]), t => o.trunkR * .5 * (1 - t * .6), 5, o.bark, [.55, .45, .35]); }
  if (o.layered) for (let l = 0; l < 3; l++) pb.crown(cx, cy - 1.8 + l * 2.2, cz, o.crownR * (1 - l * .22), lod ? 3 : 7, o.rect, mul(o.col, .9 + l * .08), rnd, {squash: o.squash, size: 1.2});
  else pb.crown(cx, cy, cz, o.crownR, lod ? Math.ceil(o.cards * .3) : o.cards, o.rect, o.col, rnd, {squash: o.squash, size: o.size || 1.25});
  if (o.roots && !lod) for (let r = 0; r < 10; r++) { const a = r / 10 * TAU + rnd() * .4, d = o.crownR * rnd.range(.3, .75), y0 = cy - 2.8; pb.tube(curve(3, t => [Math.cos(a) * d * (1 - .05 * t) + cx, y0 * (1 - t), Math.sin(a) * d * (1 - .05 * t) + cz]), t => .07 + .05 * t, 4, o.bark, [.45, .4, .34]); }
  if (o.fruit && !lod) for (let f = 0; f < 4; f++) { const a = f * 1.9; pb.blob(Math.cos(a) * .5 + pts[1][0], 1.1 + f * .55, Math.sin(a) * .5 + pts[1][2], .17, .28, .17, R.solid, [.4, .42, .16]); }
  return pb.geometry();
}

const SPECIES = {
  coconut: (R, lod, v, rnd) => {
    const pb = new PB(R), H = 11 + v * 1.4, lean = [[1.2, .6], [-1.8, .3], [.4, -1.6]][v % 3], pts = trunkPts(H, lean, [rnd.range(-.5, .5), rnd.range(-.5, .5)], lod ? 2 : 4), top = pts[pts.length - 1];
    pb.tube(pts, t => .27 - .12 * t + (t < .08 ? .08 * (1 - t / .08) : 0), lod ? 3 : 6, R.barkPalm, t => [.78 + .15 * t, .74 + .14 * t, .66 + .12 * t]);
    const n = lod ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const az = i / n * TAU + rnd.range(-.12, .12), up = i < n * .35, pitch0 = up ? rnd.range(.95, 1.25) : rnd.range(.2, .7), len = rnd.range(4.8, 6.0) * (up ? .85 : 1), old = !up && rnd() < .25;
      frond(pb, top, az, pitch0, up ? 1.0 : rnd.range(1.4, 2.0), len, rnd.range(1.9, 2.3), R.frond, old ? [.45, .52, .18] : [.2, .46, .15], lod ? 2 : 4);
    }
    if (!lod) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; pb.blob(top[0] + Math.cos(a) * .3, top[1] - .35, top[2] + Math.sin(a) * .3, .17, .21, .17, R.solid, [.42, .5, .2]); }
    return pb.geometry();
  },
  areca: (R, lod, v, rnd) => {
    const pb = new PB(R), nT = lod ? 1 : 3;
    for (let t = 0; t < nT; t++) {
      const H = rnd.range(9, 13), lean = [rnd.range(-.9, .9), rnd.range(-.9, .9)], off = [rnd.range(-.7, .7) * (t > 0), rnd.range(-.7, .7) * (t > 0)];
      const pts = trunkPts(H, lean, [0, 0], lod ? 2 : 5).map(p => [p[0] + off[0], p[1], p[2] + off[1]]), top = pts[pts.length - 1];
      pb.tube(pts, () => .07, lod ? 3 : 5, R.barkPalm, t2 => [.55 + .1 * t2, .62 + .1 * t2, .42]);
      const n = lod ? 4 : 8; for (let i = 0; i < n; i++) frond(pb, top, i / n * TAU + rnd() * .3, rnd.range(.5, 1.0), rnd.range(1, 1.6), rnd.range(2.2, 2.9), .65, R.frond, [.24, .5, .18], lod ? 1 : 4);
    }
    return pb.geometry();
  },
  banana: (R, lod, v, rnd) => {
    const pb = new PB(R), H = 1.7 + v * .5, lean = [rnd.range(-.15, .15), rnd.range(-.15, .15)];
    pb.tube(curve(lod ? 1 : 3, t => [lean[0] * t, H * t, lean[1] * t]), t => .17 - .06 * t, lod ? 4 : 6, R.barkGrey, [.5, .58, .34]);
    const n = lod ? 4 : 9, top = [lean[0], H * .96, lean[1]];
    for (let i = 0; i < n; i++) { const az = i * 2.4 + rnd() * .4, a = i / n, len = rnd.range(2.7, 3.5); frond(pb, top, az, .95 - a * .5, 1.6 + a * .6, len, len * .42, R.banana, [.4 + rnd() * .08, .72, .34], lod ? 2 : 5, .6); }
    if (!lod && v) { pb.blob(top[0] + .35, H - .25, top[2], .12, .26, .12, R.solid, [.45, .12, .35], 5); for (let k = 0; k < 4; k++) pb.blob(top[0] + .55, H - .55 - k * .08, top[2] + (k - 1.5) * .1, .06, .22, .06, R.solid, [.5, .66, .22], 4); }
    return pb.geometry();
  },
  mango: (R, lod, v, rnd) => crownTree(R, lod, rnd, {trunkH: 3.2, trunkR: .46, crownR: 5.4 + v * .6, crownY: 7.3, cards: 22, rect: R.leafB, col: [.2 + v * .03, .44, .18], bark: R.barkBrown, squash: .8}),
  jackfruit: (R, lod, v, rnd) => crownTree(R, lod, rnd, {trunkH: 3.8, trunkR: .38, crownR: 4.6, crownY: 7.0, cards: 18, rect: R.leafB, col: [.16, .4, .16], bark: R.barkBrown, squash: 1, fruit: true}),
  rubber: (R, lod, v, rnd) => crownTree(R, lod, rnd, {trunkH: 8, trunkR: .17, crownR: 2.7, crownY: 9.6, cards: 11, rect: R.leafA, col: [.34, .6, .22], bark: R.barkGrey, squash: 1.1, lean: [.4, .2], noBranch: true}),
  flameTree: (R, lod, v, rnd) => crownTree(R, lod, rnd, {trunkH: 3.4, trunkR: .38, crownR: 6.8, crownY: 8.2, cards: 18, rect: R.leafFlower, col: [.62, .85, .5], bark: R.barkBrown, squash: .5, size: 1.05}),
  banyan: (R, lod, v, rnd) => crownTree(R, lod, rnd, {trunkH: 4.2, trunkR: 1.1, crownR: 10.5, crownY: 11.5, cards: 30, rect: R.leafB, col: [.2, .44, .18], bark: R.barkGrey, squash: .62, roots: true}),
  wildA: (R, lod, v, rnd) => crownTree(R, lod, rnd, {trunkH: 11, trunkR: .5, crownR: 6.4, crownY: 14.5, cards: 20, rect: R.leafB, col: [.15 + v * .02, .34, .14], bark: R.barkBrown, squash: .85, buttress: true}),
  wildB: (R, lod, v, rnd) => crownTree(R, lod, rnd, {trunkH: 12.5, trunkR: .3, crownR: 3.6, crownY: 16, cards: 14, rect: R.leafA, col: [.26, .44, .18], bark: R.barkGrey, squash: 1.45}),
  wildC: (R, lod, v, rnd) => crownTree(R, lod, rnd, {trunkH: 8, trunkR: .42, crownR: 5.6, crownY: 10.5, cards: 18, rect: R.leafA, col: [.2, .4, .15], bark: R.barkBrown, squash: .7, layered: true}),
  pine: (R, lod) => {
    const pb = new PB(R), H = 15; pb.tube(curve(lod ? 2 : 4, t => [0, H * t, 0]), t => .3 - .24 * t, lod ? 4 : 6, R.barkBrown, [.42, .3, .22]);
    const tiers = lod ? 4 : 8;
    for (let t = 0; t < tiers; t++) { const f = t / (tiers - 1), y = 3.2 + f * (H - 3.6), rad = 3.6 * (1 - f * .88) + .5, n = lod ? 3 : 6;
      for (let k = 0; k < n; k++) { const a = k / n * TAU + t * .6, U = [-Math.sin(a), 0, Math.cos(a)], V = [Math.cos(a) * .94, -.34, Math.sin(a) * .94]; pb.card(Math.cos(a) * rad * .5, y, Math.sin(a) * rad * .5, U, V, rad * 1.1, rad * 1.0, R.pine, mul([.23, .45, .28], .8 + .3 * f), [Math.cos(a) * .5, .85, Math.sin(a) * .5]); } }
    return pb.geometry();
  },
  bamboo: (R, lod, v, rnd) => {
    const pb = new PB(R), n = lod ? 4 : 8;
    for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = rnd.range(.1, .8), H = rnd.range(8, 12.5), out = rnd.range(.8, 2.6), pts = curve(lod ? 2 : 4, t => [Math.cos(a) * (d + out * t * t), H * t, Math.sin(a) * (d + out * t * t)]);
      pb.tube(pts, t => .055 - .02 * t, 4, R.barkGrey, [.52, .62, .24]);
      for (let k = 0, m = lod ? 2 : 4; k < m; k++) { const p = pts[Math.min(pts.length - 1, Math.floor((.6 + k * .1) * pts.length))]; pb.crown(p[0], p[1], p[2], 1.4, 2, R.bamboo, [.5, .75, .3], rnd, {size: 1.4}); } }
    return pb.geometry();
  },
  bush: (R, lod, v, rnd) => { const pb = new PB(R), rect = [R.bush, R.bushRed, R.bushPink, R.bushYellow][v % 4]; pb.crown(0, .62, 0, .78, lod ? 3 : 8, rect, [.9, 1, .85], rnd, {size: 1.5, dark: .7}); return pb.geometry(); },
  shrub: (R, lod, v, rnd) => { const pb = new PB(R); pb.crown(0, .9, 0, 1.15, lod ? 4 : 8, R.leafB, [.3, .52, .25], rnd, {size: 1.5, dark: .7}); return pb.geometry(); },
  grass: (R, lod) => { const pb = new PB(R); for (let k = 0, n = lod ? 2 : 3; k < n; k++) { const a = k / n * Math.PI; pb.card(0, .4, 0, [Math.cos(a), 0, Math.sin(a)], [0, 1, 0], 1.2, .8, R.grass, [.75, .9, .6], [0, 1, 0]); } return pb.geometry(); },
  reed: (R, lod) => { const pb = new PB(R); for (let k = 0, n = lod ? 2 : 3; k < n; k++) { const a = k / n * Math.PI + .3; pb.card(0, .85, 0, [Math.cos(a), 0, Math.sin(a)], [0, 1, 0], 1.4, 1.7, R.reed, [.8, .9, .65], [0, 1, 0]); } return pb.geometry(); },
  fern: (R, lod, v, rnd) => { const pb = new PB(R), n = lod ? 4 : 7; for (let i = 0; i < n; i++) frond(pb, [0, .1, 0], i / n * TAU + rnd() * .3, .8, 1.3, rnd.range(.9, 1.3), .32, R.fern, [.4, .78, .35], 3); return pb.geometry(); },
};
// NB: vertex colours are linear, so mid-grey rock is ~0.2 (0.5 clips to white under the sun)
function rockGeo(seed, rough, detail) {
  const r = mulberry32(seed), g = new THREE.IcosahedronGeometry(1, detail), pos = g.attributes.position, col = [], cache = new Map();
  const disp = (x, y, z) => { const k = Math.round(x * 40) + ',' + Math.round(y * 40) + ',' + Math.round(z * 40); let v = cache.get(k); if (v === undefined) cache.set(k, v = .78 + r() * rough * 1.4); return v; };
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), d = disp(x, y, z); pos.setXYZ(i, x * d, Math.max(-.15, y * d * .62), z * d); const s = .15 + r() * .09 + (y > 0 ? .05 : 0); col.push(s * 1.0, s * .94, s * .84); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
SPECIES.rock = (R, lod, v) => rockGeo(11 + v * 7, .26, lod ? 0 : 1);
SPECIES.rockBig = (R, lod, v) => rockGeo(97 + v * 13, .42, lod ? 1 : 2);

// [lod0 range, lod1 range, far range]; cell = instancing group size (kept close to the LOD0 radius so one decision per group stays accurate)
export const SPECIES_INFO = {
  rock: {r: [120, 380, 700], variants: 2, cell: 320, material: 'rock'}, rockBig: {r: [180, 500, 1000], variants: 2, cell: 640, material: 'rock'},
  coconut: {r: [110, 380, 1000], variants: 2, cell: 320, shadow: true}, areca: {r: [80, 260, 600], variants: 1, cell: 288}, banana: {r: [90, 260, 560], variants: 1, cell: 256},
  mango: {r: [120, 420, 1100], variants: 2, cell: 320, shadow: true}, jackfruit: {r: [120, 420, 1100], variants: 1, cell: 320, shadow: true}, rubber: {r: [100, 400, 900], variants: 1, cell: 320},
  flameTree: {r: [130, 480, 1200], variants: 1, cell: 320, shadow: true}, banyan: {r: [160, 700, 1800], variants: 1, cell: 512, shadow: true},
  wildA: {r: [120, 450, 1500], variants: 2, cell: 384}, wildB: {r: [120, 450, 1500], variants: 1, cell: 384}, wildC: {r: [120, 450, 1500], variants: 1, cell: 384}, pine: {r: [120, 450, 1500], variants: 1, cell: 384},
  bamboo: {r: [90, 260, 600], variants: 1, cell: 288}, bush: {r: [70, 160, 260], variants: 3, cell: 192}, shrub: {r: [90, 200, 350], variants: 1, cell: 256},
  grass: {r: [50, 90, 130], variants: 1, cell: 160}, reed: {r: [60, 110, 160], variants: 1, cell: 160}, fern: {r: [45, 85, 120], variants: 1, cell: 160},
};

/* ====================================================================================================
 * Instancing / LOD manager
 * ==================================================================================================== */
export class Vegetation {
  constructor(scene, assets, {windUniform} = {}) {
    this.scene = scene; this.root = new THREE.Group(); this.root.name = 'vegetation'; scene.add(this.root);
    this.rects = assets.veg.rects; this.time = windUniform || {value: 0};
    const m = new THREE.MeshStandardMaterial({map: assets.veg.map, vertexColors: true, alphaTest: .42, roughness: .92, metalness: 0, side: THREE.DoubleSide, emissive: new THREE.Color('#3b5226'), emissiveIntensity: .1});
    m.onBeforeCompile = sh => {
      sh.uniforms.uWind = this.time; sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader;
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
 vec4 wp = instanceMatrix * vec4(position, 1.0);
 float sway = pow(max(position.y, 0.0) * 0.085, 1.6);
 transformed.x += sin(uWind * 1.5 + wp.x * .17 + wp.z * .11) * sway * .55 + sin(uWind * 3.1 + wp.z * .4) * sway * .12;
 transformed.z += cos(uWind * 1.2 + wp.x * .13 + wp.z * .19) * sway * .4;
#endif`);
    };
    m.customProgramCacheKey = () => 'kx-veg-wind';
    this.mats = {rock: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .96, metalness: 0, flatShading: true})};
    this.material = m; this.geo = new Map(); this.groups = new Map(); this.count = 0; this.rnd = mulberry32(777); this.dummy = new THREE.Object3D(); this.tmp = new THREE.Color();
  }
  geometry(name, v, lod) { const key = name + v + ':' + lod; let g = this.geo.get(key); if (!g) { g = SPECIES[name](this.rects, lod, v, mulberry32(name.length * 131 + v * 17 + lod)); this.geo.set(key, g); } return g; }
  add(name, x, y, z, {rot = 0, scale = 1, sy = scale, variant = 0, tint = null} = {}) {
    const info = SPECIES_INFO[name]; if (!info) throw new Error('species ' + name);
    const v = variant % info.variants, ci = Math.floor(x / info.cell), cj = Math.floor(z / info.cell), key = name + ':' + v + ':' + ci + ':' + cj;
    let g = this.groups.get(key); if (!g) this.groups.set(key, g = {name, v, info, list: [], cx: (ci + .5) * info.cell, cz: (cj + .5) * info.cell, meshes: null});
    g.list.push(x, y, z, rot, scale, sy, tint ? tint[0] : 1, tint ? tint[1] : 1, tint ? tint[2] : 1); this.count++;
  }
  build() {
    const d = this.dummy, c = this.tmp;
    for (const g of this.groups.values()) {
      const n = g.list.length / 9, order = Array.from({length: n}, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }   // random prefix = unbiased far-LOD thinning
      const mk = lod => { const m = new THREE.InstancedMesh(this.geometry(g.name, g.v, lod), g.info.material ? this.mats[g.info.material] : this.material, n); m.frustumCulled = true; m.castShadow = false; m.receiveShadow = true; m.visible = false; m.matrixAutoUpdate = false; return m; };
      const m0 = mk(0), m1 = mk(1); m1.instanceMatrix = m0.instanceMatrix; const l = g.list;
      for (let k = 0; k < n; k++) { const i = order[k] * 9; d.position.set(l[i], l[i + 1], l[i + 2]); d.rotation.set(0, l[i + 3], 0); d.scale.set(l[i + 4], l[i + 5], l[i + 4]); d.updateMatrix(); m0.setMatrixAt(k, d.matrix); c.setRGB(l[i + 6], l[i + 7], l[i + 8]); m0.setColorAt(k, c); }
      m1.instanceColor = m0.instanceColor; m0.instanceMatrix.needsUpdate = true; m0.computeBoundingSphere(); m1.boundingSphere = m0.boundingSphere;
      this.root.add(m0, m1); g.meshes = [m0, m1]; g.n = n; g.list = null;
    }
    this.groupList = [...this.groups.values()];
  }
  update(px, pz, quality = 'medium') {
    const q = quality === 'low' ? .5 : quality === 'high' ? 1.15 : .78;
    for (const g of this.groupList) {
      const [m0, m1] = g.meshes, [r0, r1, rf] = g.info.r, dx = g.cx - px, dz = g.cz - pz, half = g.info.cell * .55, d = Math.max(0, Math.hypot(dx, dz) - half);
      if (d > rf * q) { m0.visible = m1.visible = false; continue; }
      if (d < r0 * q) { m0.visible = true; m1.visible = false; m0.count = g.n; m0.castShadow = !!g.info.shadow && d < 70; }
      else { m0.visible = false; m1.visible = true; m1.count = d < r1 * q ? g.n : Math.max(1, Math.ceil(g.n * (1 - .8 * (d - r1 * q) / Math.max(1, (rf - r1) * q)))); }
    }
  }
}
