import {mulberry32, hash2, TAU} from '../kit/util.js';
import {pointAt} from './roads-core.js';
import {zoneAt} from './town.js';

const pickW = (r, table) => { let t = r() * table.reduce((s, e) => s + e[1], 0); for (const [k, w] of table) { t -= w; if (t <= 0) return k; } return table[0][0]; };
const TREE_R = {coconut: .3, mango: .6, jackfruit: .5, flameTree: .6, banyan: 1.4, rubber: .22, wildA: .6, wildB: .4, wildC: .5, pine: .35, areca: .15};
const TALL = {coconut: 12, mango: 9, jackfruit: 9, flameTree: 9, banyan: 14, rubber: 10, wildA: 14, wildB: 14, wildC: 11, pine: 15, areca: 11};

/** Populates gardens, street trees, urban infill, shorelines, forests (by elevation band), rubber plantations, rocks, island/median planting. */
export function populateVegetation(ctx) {
  const {veg, town, roads, roadside, collision, field, W} = ctx;
  const R = mulberry32(31415), th = W.terrainHeight, stats = {};
  const bump = k => { stats[k] = (stats[k] || 0) + 1; };
  const slopeAt = (x, z) => { const h = th(x, z); return Math.max(Math.abs(th(x + 6, z) - h), Math.abs(th(x, z + 6) - h)) / 6; };
  const free = (x, z, r, minClear = 1.5) => field.clearance(x, z) > minClear && !collision.circleHits(x, z, r, -Infinity, Infinity, ['wall']);
  const addTree = (name, x, z, {scale = R.range(.85, 1.25), variant = R.int(0, 3), tint = null, collide = true} = {}) => {
    const y = th(x, z) - .1; veg.add(name, x, y, z, {rot: R() * TAU, scale, sy: scale * R.range(.92, 1.1), variant, tint}); bump(name);
    if (collide && TREE_R[name] >= .3 && field.clearance(x, z) < 9) collision.add({x, z, w: TREE_R[name] * 2 * scale, d: TREE_R[name] * 2 * scale, baseY: y, height: (TALL[name] || 8) * scale, kind: 'tree'});
  };
  const small = (name, x, z, {scale = R.range(.8, 1.3), variant = R.int(0, 3)} = {}) => { veg.add(name, x, th(x, z) - .05, z, {rot: R() * TAU, scale, sy: scale * R.range(.85, 1.2), variant}); bump(name); };
  const tint = () => { const t = R.range(.85, 1.1); return [t, t * R.range(.95, 1.05), t * R.range(.9, 1.05)]; };

  /* ---- A. compound gardens ---- */
  for (const g of town.gardenSpots) {
    const P = (lx, lz) => [g.x + lx * Math.cos(g.rot) + lz * Math.sin(g.rot), g.z - lx * Math.sin(g.rot) + lz * Math.cos(g.rot)];
    const frontZ = g.zf - .9, houseBack = g.zc - g.hd, houseFront = g.zc + g.hd;
    for (let x = -g.hw + 1.2; x < g.hw - .8; x += R.range(1.5, 2.4)) if (Math.abs(x) > g.gate + 1.4 && R() < .8) { const [px, pz] = P(x, frontZ); if (free(px, pz, .7, .4)) small('bush', px, pz, {variant: R.int(0, 3), scale: R.range(.8, 1.3)}); }
    for (let x = -g.hw + 1.6; x < g.hw - 1; x += R.range(2.2, 3.6)) if (R() < .6) { const [px, pz] = P(x, houseFront + .9); if (free(px, pz, .5, .4)) small('bush', px, pz, {variant: R.int(1, 3), scale: R.range(.55, .85)}); }
    for (let k = R.int(1, 3); k > 0; k--) { const [px, pz] = P(R.range(-g.hw + 1.8, g.hw - 1.8), R.range(g.zb + 2.2, houseBack - 1.5)); if (free(px, pz, 2.2, 1)) addTree('coconut', px, pz); }
    if (R() < .45) { const [px, pz] = P(R.range(-g.hw + 3, g.hw - 3), R.range(g.zb + 3, houseBack - 2.5)); if (free(px, pz, 3.2, 1)) addTree(R() < .5 ? 'mango' : 'jackfruit', px, pz); }
    if (R() < .5) { const [px, pz] = P(R.range(-g.hw + 2, g.hw - 2), R.range(g.zb + 2, houseBack - 1.5)); if (free(px, pz, 1.2, 1)) addTree('areca', px, pz, {scale: R.range(.8, 1.1)}); }
    for (let k = R.int(0, 2); k > 0; k--) { const [cx, cz] = P(R.range(-g.hw + 1.5, g.hw - 1.5), R.range(g.zb + 1.5, houseBack - 1.2)); if (!free(cx, cz, 1.2, .8)) continue; for (let i = 0; i < R.int(2, 3); i++) { const a = R() * TAU, d = R.range(.3, 1.1); small('banana', cx + Math.cos(a) * d, cz + Math.sin(a) * d, {scale: R.range(.8, 1.2), variant: R.int(0, 1)}); } }
    for (let k = 0; k < 6; k++) { const [px, pz] = P(R.range(-g.hw + .8, g.hw - .8), R.range(g.zb + .8, frontZ)); if (free(px, pz, .6, .4)) small('grass', px, pz); }
  }

  /* ---- B. street trees behind the pavement ---- */
  for (const ed of roads.edgeData) {
    const {e, S} = ed; if (['trail', 'forest'].includes(e.type) || e.len < 40) continue;
    const urban = ed.urban, spacing = urban ? 24 : e.type === 'highway' || e.type === 'primary' ? 30 : 52;
    for (let s = ed.padA + 6; s < e.len - ed.padB - 6; s += spacing * R.range(.75, 1.3)) for (const side of [-1, 1]) {
      if (!urban && R() < .45) continue; const p = pointAt(S, s), off = side * (e.width / 2 + (ed.curbs ? 3.3 : 2.4) + R.range(0, 1.6)), x = p.x + p.nx * off, z = p.z + p.nz * off;
      if (!free(x, z, 1.6, 1.2) || W.isWater(x, z) || W.waterInfo(x, z).distance < 6) continue;
      const zone = zoneAt(x, z), kind = pickW(R, urban ? [['flameTree', 3], ['mango', 3], ['coconut', 4], ['jackfruit', 1], ['banyan', zone === 'core' ? .12 : 0]] : [['coconut', 4], ['mango', 2], ['wildC', 1], ['flameTree', 1]]);
      addTree(kind, x, z, {variant: R.int(0, 2), tint: tint()});
    }
  }

  /* ---- C. urban / village infill ---- */
  const spacing = 7.5;
  for (let z = -1500; z < 1500; z += spacing) for (let x = -1950; x < 1950; x += spacing) {
    const px = x + R.range(0, spacing), pz = z + R.range(0, spacing); if ((px / 1850) ** 2 + (pz / 1400) ** 2 > 1) continue;
    const zone = zoneAt(px, pz), p = {core: .22, mid: .62, outer: .78, rural: .5}[zone];
    if (R() > p || field.clearance(px, pz) < 2.2 || W.forestZone(px, pz)) continue;
    const wi = W.waterInfo(px, pz); if (wi.distance < 6 || collision.circleHits(px, pz, 1.6, -Infinity, Infinity, ['wall'])) continue;
    const near = wi.distance < 70;
    const kind = pickW(R, near ? [['coconut', 5], ['banana', 3], ['bush', 1.5], ['mango', .4], ['areca', 1]] : zone === 'core' ? [['coconut', 3], ['banana', 2], ['bush', 3], ['grass', 2], ['mango', 1]] : [['coconut', 7], ['banana', 3], ['mango', 1.1], ['jackfruit', .8], ['areca', 1.4], ['bush', 1.6], ['grass', 1.2], ['flameTree', .15]]);
    if (kind === 'banana') { for (let i = 0, n = R.int(2, 3); i < n; i++) { const a = R() * TAU, d = R.range(.2, 1.3); small('banana', px + Math.cos(a) * d, pz + Math.sin(a) * d, {scale: R.range(.8, 1.25), variant: R.int(0, 1)}); } }
    else if (['bush', 'grass'].includes(kind)) small(kind, px, pz, {variant: R.int(0, 3), scale: kind === 'bush' ? R.range(.8, 1.35) : R.range(.9, 1.5)});
    else if (field.clearance(px, pz) > 3.4 && !collision.circleHits(px, pz, 2.4, -Infinity, Infinity, ['wall'])) addTree(kind, px, pz, {tint: tint(), variant: R.int(0, 3)});
  }
  for (const ed of roads.edgeData) {   // grass tufts and ferns along road verges soften the clean mesh border
    const {e, S} = ed; if (e.len < 20 || ['trail', 'forest'].includes(e.type)) continue;
    for (let s = ed.padA + 3; s < e.len - ed.padB - 3; s += R.range(5, 9)) for (const side of [-1, 1]) {
      const p = pointAt(S, s), off = side * (e.width / 2 + (ed.curbs ? 2.8 : 1.5) + R.range(0, 2)), x = p.x + p.nx * off, z = p.z + p.nz * off;
      if (R() < .55 && free(x, z, .4, .5) && !W.isWater(x, z)) small(R() < .75 ? 'grass' : R() < .6 ? 'fern' : 'bush', x, z, {variant: R.int(0, 3)});
    }
  }

  /* ---- D. water edges: reeds, palms, rocks ---- */
  const rockAt = (x, z, big) => { veg.add(big ? 'rockBig' : 'rock', x, th(x, z) - .15, z, {rot: R() * TAU, scale: big ? R.range(1.6, 3.2) : R.range(.5, 1.4), sy: R.range(.7, 1.2), variant: R.int(0, 2)}); bump('rock'); };
  const bankPlant = (x, z, d) => {
    if (field.clearance(x, z) < 2.5 || collision.circleHits(x, z, 1.5, -Infinity, Infinity, ['wall'])) return;
    if (d < 5) { if (R() < .55) small('reed', x, z, {scale: R.range(.8, 1.5)}); else if (R() < .5) rockAt(x, z, false); }
    else if (d < 16) { if (R() < .22) small('bush', x, z, {variant: 0}); else if (R() < .35) addTree('coconut', x, z, {collide: false, tint: tint()}); else if (R() < .5) small('reed', x, z); }
    else { const r = R(); if (r < .6) addTree('coconut', x, z, {tint: tint()}); else if (r < .8) { for (let i = 0; i < 3; i++) small('banana', x + R.range(-1, 1), z + R.range(-1, 1)); } else small('bush', x, z, {variant: R.int(0, 3)}); }
  };
  for (const w of W.watercourses) {
    if (w.name === 'Kurinji River') continue;
    for (let i = 0; i < w.points.length - 1; i++) {
      const a = w.points[i], b = w.points[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
      for (let s = 0; s < len; s += 11) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        const d = [2.5, 9, 24][k] + R.range(0, 6), t = s / len, cx = a[0] + (b[0] - a[0]) * t, cz = a[1] + (b[1] - a[1]) * t, off = side * (w.width / 2 + d), x = cx + nx * off + R.range(-3, 3), z = cz + nz * off + R.range(-3, 3);
        const wi = W.waterInfo(x, z); if (wi.distance < 1.5 || wi.distance > 60) continue; bankPlant(x, z, wi.distance);
      }
    }
  }
  for (const L of W.lakes) {
    const per = Math.PI * (L.rx + L.rz), n = Math.floor(per / 14);
    for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .05, rr = 1 + R.range(.0, .05) + (R() < .5 ? 0 : .035), x = L.cx + Math.cos(a) * L.rx * rr, z = L.cz + Math.sin(a) * L.rz * rr; const wi = W.waterInfo(x, z); if (wi.distance < 1.5 || wi.distance > 60) continue; bankPlant(x, z, wi.distance); if (R() < .6) { const x2 = x + Math.cos(a) * R.range(8, 35), z2 = z + Math.sin(a) * R.range(8, 35), w2 = W.waterInfo(x2, z2); if (w2.distance > 6) bankPlant(x2, z2, w2.distance); } }
  }

  /* ---- E. forests by elevation band (the Western Ghats) ---- */
  const FS = 14;
  for (let z = -4100; z < 4100; z += FS) for (let x = -5950; x < 5950; x += FS) {
    if (!W.forestZone(x, z)) continue;
    const px = x + R.range(0, FS), pz = z + R.range(0, FS); if (!W.forestZone(px, pz) || field.clearance(px, pz) < 4.5) continue;
    const h = th(px, pz), sl = slopeAt(px, pz); if (sl > .72) continue; const wi = W.waterInfo(px, pz); if (wi.distance < 5) continue;
    if (h > 600 && R() > .3) continue; if (collision.circleHits(px, pz, 2, -Infinity, Infinity, ['wall'])) continue;
    const band = h < 130 ? [['wildA', 30], ['wildC', 18], ['mango', 8], ['jackfruit', 6], ['wildB', 10], ['bamboo', 6], ['shrub', 12], ['rubber', 4], ['fern', 6]] :
      h < 380 ? [['wildA', 26], ['wildB', 16], ['wildC', 14], ['bamboo', 8], ['shrub', 16], ['fern', 10], ['pine', 4], ['mango', 3]] :
      h < 560 ? [['pine', 30], ['wildB', 22], ['wildA', 10], ['shrub', 18], ['fern', 8], ['grass', 12]] : [['grass', 50], ['shrub', 24], ['pine', 14], ['fern', 12]];
    const kind = pickW(R, wi.distance < 40 ? [['bamboo', 20], ['wildA', 20], ['fern', 15], ['shrub', 15], ['reed', 5]] : band);
    if (['shrub', 'fern', 'grass', 'reed'].includes(kind)) { small(kind, px, pz, {scale: R.range(.8, 1.5)}); if (R() < .6) small('fern', px + R.range(-3, 3), pz + R.range(-3, 3)); }
    else addTree(kind, px, pz, {scale: R.range(.8, 1.4), variant: R.int(0, 1), tint: tint(), collide: false});
    if (R() < .07) rockAt(px + 2, pz + 2, R() < .3);
  }

  /* ---- F. rubber plantations (planted in rows) ---- */
  for (const [cx, cz, w, d, ang] of [[-2900, 1130, 330, 240, .42], [-1750, 1460, 280, 230, -.3], [-3350, 400, 300, 260, .1], [1750, -1750, 260, 220, .6]]) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let i = -w / 2; i < w / 2; i += 5.2) for (let j = -d / 2; j < d / 2; j += 4.2) {
      const x = cx + i * ca - j * sa + R.range(-.4, .4), z = cz + i * sa + j * ca + R.range(-.4, .4);
      if (field.clearance(x, z) < 6 || W.waterInfo(x, z).distance < 10 || slopeAt(x, z) > .35 || collision.circleHits(x, z, 2, -Infinity, Infinity, ['wall'])) continue;
      addTree('rubber', x, z, {scale: R.range(.9, 1.2), collide: false});
    }
  }

  /* ---- G. rocks and cliffs on steep ground ---- */
  for (let z = -4100; z < 4100; z += 38) for (let x = -5950; x < 5950; x += 38) {
    const px = x + R.range(0, 38), pz = z + R.range(0, 38); if (hash2(Math.floor(px / 38), Math.floor(pz / 38), 5) > .5) continue;
    const sl = slopeAt(px, pz); if (sl < .38 && R() > .035) continue; if (field.clearance(px, pz) < 6 || W.isWater(px, pz)) continue;
    const big = sl > .5 && R() < .45; rockAt(px, pz, big); if (big && R() < .6) rockAt(px + R.range(-5, 5), pz + R.range(-5, 5), false);
  }

  /* ---- H. roundabout island, median planting, temple compounds ---- */
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; small('bush', Math.cos(a) * 28.5, Math.sin(a) * 28.5, {variant: 1 + i % 3, scale: 1.1}); }
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + .1; small('bush', Math.cos(a) * 21, Math.sin(a) * 21, {variant: (i + 1) % 4, scale: 1.35}); }
  addTree('flameTree', 9, 5, {scale: 1.0, collide: false}); addTree('coconut', -9, 6, {scale: .9, collide: false}); addTree('coconut', 4, -11, {scale: .85, collide: false}); addTree('coconut', -3, -6, {scale: 1.0, collide: false});
  for (const m of roadside.medians) if (R() < .9) small('bush', m.x + R.range(-.2, .2), m.z + R.range(-.2, .2), {variant: R.int(1, 3), scale: R.range(.85, 1.25)});
  for (const rec of town.placed.filter(p => p.type === 'temple')) {
    const P = (lx, lz) => [rec.x + lx * Math.cos(rec.rot) + lz * Math.sin(rec.rot), rec.z - lx * Math.sin(rec.rot) + lz * Math.cos(rec.rot)];
    const [bx, bz] = P(-rec.hw * .55, -rec.hd * .35); addTree('banyan', bx, bz, {scale: R.range(.8, 1.1)});
    for (let k = 0; k < 6; k++) { const [x, z] = P(R.range(-rec.hw, rec.hw), R.range(-rec.hd, rec.hd) - 2); if (free(x, z, 2, 1) && (Math.abs(x - rec.x) > 4 || Math.abs(z - rec.z) > 4)) addTree('coconut', x, z); }
  }
  return stats;
}
