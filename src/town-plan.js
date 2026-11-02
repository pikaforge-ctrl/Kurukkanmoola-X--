// Organic Kerala town street network. Pure and deterministic (seeded) so every client builds the same map.
// world-layout.js calls townNetwork() with its own terrain/water functions and the already-registered main roads; this file has
// no renderer/DOM dependency so it is unit-testable.
import {mulberry32, clamp, lerp, smooth} from './kit/util.js';

const D2R = Math.PI / 180;

/** Catmull-Rom through control points; the returned polyline contains every control point exactly. */
export function catmullRom(pts, closed = false, perSpan = 12) {
  const n = pts.length, out = [], P = i => pts[closed ? (i % n + n) % n : clamp(i, 0, n - 1)], spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < perSpan; k++) { const t = k / perSpan, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(c => .5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); }
  }
  out.push(closed ? out[0].slice() : pts[n - 1].slice());
  return out;
}

/** Control points of the perturbed outer loop; Village Lanes start exactly on these. */
export function outerLoopPoints(isClear) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, k = 1 + .11 * Math.sin(3 * a + 1) + .06 * Math.sin(5 * a + 2) + .03 * Math.sin(8 * a);
    let x = Math.cos(a) * 1050 * k, z = Math.sin(a) * 800 * k;
    for (let tries = 0; tries < 8 && !isClear(x, z); tries++) { x *= 1.07; z *= 1.07; }
    pts.push([Math.round(x), Math.round(z)]);
  }
  return pts;
}

const RING = [[0, 372], [30, 405], [60, 338], [90, 300], [120, 372], [150, 330], [180, 285], [210, 235], [240, 195], [270, 175], [300, 205], [330, 305]];

class SegIndex {
  constructor(cell = 48) { this.cell = cell; this.map = new Map(); this.n = 0; }
  add(a, b, w, tag) {
    const s = {a, b, w, tag, id: this.n++}, c = this.cell;
    for (let iz = Math.floor((Math.min(a[1], b[1]) - 1) / c); iz <= Math.floor((Math.max(a[1], b[1]) + 1) / c); iz++)
      for (let ix = Math.floor((Math.min(a[0], b[0]) - 1) / c); ix <= Math.floor((Math.max(a[0], b[0]) + 1) / c); ix++) { const k = ix + ':' + iz; let l = this.map.get(k); if (!l) this.map.set(k, l = []); l.push(s); }
    return s;
  }
  near(x, z, r) {
    const c = this.cell, out = new Set();
    for (let iz = Math.floor((z - r) / c); iz <= Math.floor((z + r) / c); iz++) for (let ix = Math.floor((x - r) / c); ix <= Math.floor((x + r) / c); ix++) { const l = this.map.get(ix + ':' + iz); if (l) for (const s of l) out.add(s); }
    return out;
  }
  nearest(x, z, r, skip) {
    let best = null;
    for (const s of this.near(x, z, r)) {
      if (skip && skip(s)) continue;
      const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], l2 = dx * dx + dz * dz || 1, t = clamp(((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l2, 0, 1), px = s.a[0] + dx * t, pz = s.a[1] + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < r && (!best || d < best.d)) best = {d, s, t, px, pz};
    }
    return best;
  }
  hit(px, pz, qx, qz, skip) {
    let best = null; const mx = (px + qx) / 2, mz = (pz + qz) / 2, r = Math.hypot(qx - px, qz - pz) / 2 + 2;
    for (const s of this.near(mx, mz, r)) {
      if (skip && skip(s)) continue;
      const rx = qx - px, rz = qz - pz, sx = s.b[0] - s.a[0], sz = s.b[1] - s.a[1], den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) continue;
      const t = ((s.a[0] - px) * sz - (s.a[1] - pz) * sx) / den, u = ((s.a[0] - px) * rz - (s.a[1] - pz) * rx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (!best || t < best.t)) best = {t, u, s, x: px + rx * t, z: pz + rz * t};
    }
    return best;
  }
}

/** env: {waterInfo, landBase, segs (existing road segments {a,b,width}), keepClear: [{x,z,r}], outerLoop, seed} -> [{points,width,name,type}] */
export function townNetwork(env) {
  const rnd = mulberry32(env.seed ?? 4471), idx = new SegIndex(48), out = [], keep = env.keepClear || [];
  const clearOfKeep = (x, z) => !keep.some(k => Math.hypot(x - k.x, z - k.z) < k.r);
  const inTown = (x, z) => (x / 1750) ** 2 + (z / 1280) ** 2 < 1;
  const dry = (x, z, m = 24) => env.waterInfo(x, z).distance > m;
  for (const s of env.segs) idx.add(s.a, s.b, s.width, 'main');

  // 1. bazaar ring road around the roundabout (irregular, never the same radius twice)
  out.push({points: catmullRom(RING.map(([a, r]) => [Math.cos(a * D2R) * r, Math.sin(a * D2R) * r]), true, 9), width: 7, name: 'Bazaar Ring Road', type: 'secondary', gen: 0});
  // 2. outer loop through the Village Lane roots
  out.push({points: catmullRom(env.outerLoop || outerLoopPoints((x, z) => dry(x, z, 40)), true, 14), width: 6.5, name: 'Outer Ring Road', type: 'secondary', gen: 0});
  for (const o of out) for (let i = 1; i < o.points.length; i++) idx.add(o.points[i - 1], o.points[i], o.width, 'g0');

  // 3. grow streets generation by generation
  const seedsFor = gen => {
    const list = [], polylines = [];
    if (gen === 0) {
      let cur = null, last = null;
      for (const s of env.segs) {
        if (s.width < 6 || !inTown(s.a[0], s.a[1])) { cur = null; continue; }
        if (!cur || !last || Math.hypot(last.b[0] - s.a[0], last.b[1] - s.a[1]) > .01) { cur = []; polylines.push({pts: cur, w: s.width, tag: 'main'}); }
        if (!cur.length) cur.push(s.a); cur.push(s.b); last = s;
      }
      for (const o of out) polylines.push({pts: o.points, w: o.width, tag: 'g0'});
    } else for (const o of out) if (o.gen === gen) polylines.push({pts: o.points, w: o.width, tag: 'g' + gen});
    for (const pl of polylines) {
      let acc = rnd.range(20, 60);
      for (let i = 1; i < pl.pts.length; i++) {
        const a = pl.pts[i - 1], b = pl.pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += len;
        const r = Math.hypot(b[0], b[1]), spacing = lerp(44, 125, smooth(140, 1250, r)) * (gen ? 1.12 : 1);
        if (acc >= spacing && len > 1e-6 && r > 76 && inTown(b[0], b[1])) {
          acc = rnd.range(-12, 14); const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
          for (const side of [1, -1]) if (rnd.chance(.94)) list.push({x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, tx, tz, side, w: pl.w, tag: pl.tag, r});
        }
      }
    }
    return list.sort((p, q) => p.r - q.r + rnd.range(-70, 70));
  };

  let totalLen = 0; const MAX_LEN = 78000;
  for (let gen = 0; gen < 4; gen++) {
    for (const sd of seedsFor(gen)) {
      if (totalLen > MAX_LEN) break;
      const gap = lerp(25, 50, smooth(150, 1250, sd.r)), start = sd.w / 2 + gap * .55;
      // outward normal on the chosen side is (-tz*side, tx*side); heading is measured as atan2(z, x)
      let hd = Math.atan2(sd.tx * sd.side, -sd.tz * sd.side) + rnd.gauss() * .22, px = sd.x, pz = sd.z, turn = 0, len = 0, connected = false;
      const pts = [[px, pz]], step = rnd.range(15, 21), maxLen = rnd.range(150, 620) * (gen > 1 ? .7 : gen ? .85 : 1);
      const parent = s => s.tag === sd.tag && Math.hypot(s.a[0] - sd.x, s.a[1] - sd.z) < start + 40;
      while (len < maxLen) {
        turn = turn * .88 + rnd.gauss() * .07; hd += turn;
        const qx = px + Math.cos(hd) * step, qz = pz + Math.sin(hd) * step;
        if (!inTown(qx, qz) || !dry(qx, qz) || !clearOfKeep(qx, qz)) break;
        if (Math.abs(env.landBase(qx, qz) - env.landBase(px, pz)) > step * .09) break;
        const hit = idx.hit(px, pz, qx, qz, len < start ? parent : null);
        if (hit) { const sdx = hit.s.b[0] - hit.s.a[0], sdz = hit.s.b[1] - hit.s.a[1], sl = Math.hypot(sdx, sdz) || 1, ang = Math.abs((Math.cos(hd) * sdz - Math.sin(hd) * sdx) / sl); if (ang > .42 && len > 38) { pts.push([hit.x, hit.z]); connected = true; len += step * hit.t; } break; }
        const nb = idx.nearest(qx, qz, gap, len < start ? parent : null);
        if (nb && nb.d < nb.s.w / 2 + gap * .5) { const sdx = nb.s.b[0] - nb.s.a[0], sdz = nb.s.b[1] - nb.s.a[1], sl = Math.hypot(sdx, sdz) || 1, ang = Math.abs((Math.cos(hd) * sdz - Math.sin(hd) * sdx) / sl); if (ang > .5 && len > 38 && nb.d < gap * .8) { pts.push([nb.px, nb.pz]); connected = true; } break; }
        pts.push([qx, qz]); px = qx; pz = qz; len += step;
      }
      if (len < 62 && !connected) continue;
      if (!connected && rnd.chance(.12 + gen * .1)) continue;
      const lane = rnd.chance(gen ? .55 : .3 + (sd.r > 500 ? .2 : 0)), width = lane ? 3.6 : 4.8, name = lane ? 'Town Lane' : 'Town Street';
      out.push({points: pts, width, name, type: lane ? 'lane' : 'residential', gen: gen + 1}); totalLen += len;
      for (let i = 1; i < pts.length; i++) idx.add(pts[i - 1], pts[i], width, 'g' + (gen + 1));
    }
  }
  return out;
}
