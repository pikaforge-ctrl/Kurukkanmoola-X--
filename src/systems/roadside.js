import * as THREE from 'three';
import {terrainHeight, isWater} from '../world-layout.js';
import {mulberry32} from '../kit/util.js';
import {sampleEdge, pointAt, urbanAt, coreAt} from './roads-core.js';

const metalDark = [.28, .3, .3];

/** Street lamps, poles, wires, signs, bus shelters, medians. Small details go in the 'atlasS' bucket (culled at ~500 m). */
export function buildRoadside({B, K, graph, roads, buildings, collision, M, field}) {
  const rnd = mulberry32(2211), A = B.world('atlasS'), conc = K.r('concrete'), metal = K.r('metal');
  const lamps = [], poles = [], busStops = [], signsPlaced = [], medians = [];
  const jx = new Map();
  for (const j of roads.junctions) { const k = Math.floor(j.x / 40) + ':' + Math.floor(j.z / 40); (jx.get(k) || jx.set(k, []).get(k)).push(j); }
  const nearJunction = (x, z, extra = 3) => { const cx = Math.floor(x / 40), cz = Math.floor(z / 40); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const j of jx.get((cx + dx) + ':' + (cz + dz)) || []) if (Math.hypot(j.x - x, j.z - z) < j.r + extra) return true; return false; };
  const hubNear = (x, z) => Math.hypot(x, z) < 62;
  const clearToPlace = (x, z, r = .6) => !isWater(x, z) && !hubNear(x, z) && !nearJunction(x, z, 1.5) && (!field || field.clearance(x, z) > .7) && !collision.circleHits(x, z, r);

  /* ---------------- street lamps (edge based, on the pavement) ---------------- */
  for (const ed of roads.edgeData) {
    const {e, S} = ed; if (!ed.curbs || e.width < 5.8 || e.type === 'lane') continue;
    const both = e.width >= 7, spacing = both ? 34 : 40;
    for (let s = ed.padA + 5, k = 0; s < e.len - ed.padB - 5; s += spacing, k++) {
      const side = both ? (k % 2 ? 1 : -1) : (rnd() < .5 ? 1 : -1), p = pointAt(S, s), off = side * (e.width / 2 + 1.0), x = p.x + p.nx * off, z = p.z + p.nz * off; if (!clearToPlace(x, z, .25)) continue;
      const y = Math.max(p.y, terrainHeight(x, z)) + .38, w = A.at(x, y, z, 0), ax = -p.nx * side, az = -p.nz * side;
      w.cyl(0, 0, 0, .1, .06, 8, 5, metal, [.35, .36, .36], {cap: false});
      w.beam([0, 7.9, 0], [ax * 1.9, 8.25, az * 1.9], .09, metal, metalDark);
      w.use('sign').box(ax * 2.0, 8.2, az * 2.0, .6, .12, .3, K.S.glow, [.95, .95, .9], 'px nx pz nz ny'); w.use('atlasS');
      lamps.push({x: x + ax * 2.0, y: y + 8.1, z: z + az * 2.0});
      collision.add({x, z, w: .3, d: .3, baseY: y, height: 8, kind: 'pole'});
    }
  }

  /* ---------------- electric poles + overhead wires (chain based so lines run continuously) ---------------- */
  const wireCells = new Map();
  const addWire = (a, b, sag) => {
    const cx = Math.floor((a[0] + b[0]) / 2 / 320) + ':' + Math.floor((a[2] + b[2]) / 2 / 320); let arr = wireCells.get(cx); if (!arr) wireCells.set(cx, arr = []);
    const n = Math.max(3, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 6)); let prev = a;
    for (let i = 1; i <= n; i++) { const t = i / n, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]; arr.push(prev[0], prev[1], prev[2], q[0], q[1], q[2]); prev = q; }
  };
  for (const c of graph.chains) {
    if (c.width < 4.4 || ['trail', 'forest'].includes(c.type)) continue;
    const ch = {pts: c.pts.map((p, i) => [p[0], p[1], c.ys[i]])}, S = sampleEdge(ch, 8), last = S[S.length - 1].s;
    const urban = urbanAt(c.pts[0][0], c.pts[0][1]) || urbanAt(c.pts[c.pts.length >> 1][0], c.pts[c.pts.length >> 1][1]);
    if (!urban && !['highway', 'primary'].includes(c.type)) continue;
    const spacing = c.type === 'lane' ? 50 : 44, side = c.width >= 7 ? -1 : 1; let prevTop = null, k = 0;
    for (let s = 12; s < last - 8; s += spacing + rnd.range(-4, 4), k++) {
      const p = pointAt(S, s), off = side * (c.width / 2 + (urbanAt(p.x, p.z) ? 2.9 : 2.0)), x = p.x + p.nx * off, z = p.z + p.nz * off;
      if (!clearToPlace(x, z, .3) || (!urbanAt(x, z) && !['highway', 'primary'].includes(c.type))) { prevTop = null; continue; }
      const y = Math.max(p.y, terrainHeight(x, z)) + .1, rot = Math.atan2(-p.nz, p.nx), w = A.at(x, y, z, rot);
      w.box(0, 3.7, 0, .22, 7.4, .22, conc, [.74, .74, .7], 'px nx pz nz');
      w.beam([-.95, 6.95, 0], [.95, 6.95, 0], .1, metal, metalDark);
      for (const dx of [-.85, 0, .85]) w.box(dx, 7.06, 0, .09, .2, .09, metal, [.32, .5, .42], 'px pz');
      if (k % 9 === 4) { w.box(.5, 5.2, 0, .7, .95, .55, metal, [.4, .46, .42], 'px nx pz nz py'); w.box(-.5, 5.2, 0, .7, .95, .55, metal, [.4, .46, .42], 'px nx pz nz py'); }
      collision.add({x, z, w: .35, d: .35, baseY: y, height: 7, kind: 'pole'});
      const ax = Math.cos(rot), az = -Math.sin(rot), top = [-.85, 0, .85].map(d => [x + ax * d, y + 7.0, z + az * d]);
      poles.push({x, y, z, ax, az});
      if (prevTop) { const L = Math.hypot(top[1][0] - prevTop[1][0], top[1][2] - prevTop[1][2]); if (L < 90) for (let i = 0; i < 3; i++) addWire(prevTop[i], top[i], .35 + L * L * .0004); }
      prevTop = top;
    }
  }
  const wireMat = new THREE.LineBasicMaterial({color: 0x1c1e1d}), wireMeshes = [];
  const finishWires = () => {
    for (const arr of wireCells.values()) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeBoundingSphere();
      const m = new THREE.LineSegments(g, wireMat); m.frustumCulled = true; m.matrixAutoUpdate = false; m.userData.center = {x: g.boundingSphere.center.x, z: g.boundingSphere.center.z}; wireMeshes.push(m);
    }
    wireCells.clear(); return wireMeshes;
  };

  /* ---------------- bus shelters on urban main roads ---------------- */
  for (const ed of roads.edgeData) {
    const {e, S} = ed; if (!ed.urban || e.width < 6.4 || e.len < 110 || e.type === 'lane') continue;
    if (rnd() > (coreAt(S[0].x, S[0].z) ? .75 : .4)) continue;
    const side = rnd() < .5 ? 1 : -1, s = e.len * rnd.range(.35, .65), p = pointAt(S, s), off = side * (e.width / 2 + 3.4), x = p.x + p.nx * off, z = p.z + p.nz * off, rot = Math.atan2(-p.nx * side, -p.nz * side);
    if (nearJunction(x, z, 10) || isWater(x, z) || collision.overlapsBox(x, z, 5.8, 3, rot, .5)) continue;
    if (field) { let clear = true; for (const [lx, lz] of [[0, 0], [-2.9, -1.5], [2.9, -1.5], [-2.9, 1.5], [2.9, 1.5], [0, 1.8]]) if (field.clearance(x + lx * Math.cos(rot) + lz * Math.sin(rot), z - lx * Math.sin(rot) + lz * Math.cos(rot)) < .9) clear = false; if (!clear) continue; }
    const y = Math.max(p.y, terrainHeight(x, z)) + .38, info = buildings.busShelter(x, y, z, rot, {});
    collision.add({x, z, w: info.hw * 2, d: info.hd * 2, rot, baseY: y, height: 3, kind: 'shelter'});
    busStops.push({x, z, y, rot, roadX: p.x, roadZ: p.z, side, edge: e.id});
  }

  /* ---------------- road signs ---------------- */
  const RS = K.assets.roadSigns.rects, AA = B.world('atlas');
  const signPost = (x, z, y, rot, name, h = 2.6, scale = 1, double = true) => {
    const r = RS[name]; if (!r) return; const w = AA.at(x, y, z, rot, 'atlas');
    w.box(0, h / 2, 0, .07, h, .07, metal, [.4, .4, .42], 'px nx pz nz');
    const bw = (name.startsWith('dir') || name.startsWith('name') || name === 'welcome' ? 1.9 : .75) * scale, bh = bw * r.aspect, cy = h - bh / 2 + .1; w.use('roadSign');
    w.quad([-bw / 2, cy - bh / 2, .06], [bw / 2, cy - bh / 2, .06], [bw / 2, cy + bh / 2, .06], [-bw / 2, cy + bh / 2, .06], r.rect, [1, 1, 1]);
    if (double) w.quad([bw / 2, cy - bh / 2, -.06], [-bw / 2, cy - bh / 2, -.06], [-bw / 2, cy + bh / 2, -.06], [bw / 2, cy + bh / 2, -.06], r.rect, [.7, .7, .7]);
    w.use('atlas'); signsPlaced.push({x, z, name}); collision.add({x, z, w: .25, d: .25, baseY: y, height: h, kind: 'pole'});
  };
  const dirNames = ['dirTown', 'dirHill', 'dirBack', 'dirHosp'];
  for (const j of roads.junctions) {
    if (j.maxW < 6.4 || !urbanAt(j.x, j.z) || rnd() > .5) continue;
    const n = graph.nodes[j.node], er = n.edges.map(r => graph.edges[r.e]).sort((a, b) => b.width - a.width), e = er[er.length - 1], endIsA = e.a === n.id;
    const q = endIsA ? e.pts[Math.min(1, e.pts.length - 1)] : e.pts[e.pts.length - 2], dx = q[0] - n.x, dz = q[1] - n.z, l = Math.hypot(dx, dz) || 1;
    const fx = dx / l, fz = dz / l, nx = -fz, nz = fx, off = e.width / 2 + 3.3, x = n.x + fx * (j.r + 3) + nx * off, z = n.z + fz * (j.r + 3) + nz * off;
    if (!clearToPlace(x, z, .4)) continue;
    signPost(x, z, Math.max(n.y, terrainHeight(x, z)) + .3, Math.atan2(fx, fz), dirNames[Math.floor(rnd() * 4)], 3.1, 1);
    if (rnd() < .6) signPost(x + nx * .4, z + nz * .4, Math.max(n.y, terrainHeight(x, z)) + .3, Math.atan2(fx, fz), 'speed30', 2.4, .9);
  }
  for (const ed of roads.edgeData) {
    const {e, S} = ed; if (!ed.urban || e.width < 6 || e.len < 70 || rnd() > .5) continue;
    const s = e.len * rnd.range(.25, .75), p = pointAt(S, s), side = rnd() < .5 ? 1 : -1, off = side * (e.width / 2 + 3.2), x = p.x + p.nx * off, z = p.z + p.nz * off; if (!clearToPlace(x, z, .4)) continue;
    const name = e.name === 'College Road' ? 'nameCollege' : e.name === 'Bazaar Ring Road' ? 'nameBazaar' : rnd() < .5 ? 'nameTown' : 'nameMarket';
    signPost(x, z, Math.max(p.y, terrainHeight(x, z)) + .3, Math.atan2(p.nz, -p.nx), rnd() < .3 ? 'shield' : name, 2.9, .9);
  }
  for (const name of ['East Highway', 'North Town Road', 'Dam Road', 'Mountain Road', 'College Road', 'South Backwater Road']) {   // welcome gates
    const c = graph.chains.find(c => c.name === name); if (!c) continue;
    const S = sampleEdge({pts: c.pts.map((p, i) => [p[0], p[1], c.ys[i]])}, 8); let s = 0; for (const q of S) if (Math.hypot(q.x, q.z) > 1180) { s = q.s; break; } if (!s) continue;
    const p = pointAt(S, s), off = c.width / 2 + 3.4, x = p.x + p.nx * off, z = p.z + p.nz * off; if (isWater(x, z)) continue;
    signPost(x, z, Math.max(p.y, terrainHeight(x, z)) + .3, Math.atan2(p.nz, -p.nx), 'welcome', 3.6, 1.55, true);
  }

  /* ---------------- planted medians on the main approach roads ---------------- */
  for (const ed of roads.edgeData) {
    const {e, S} = ed; if (!['East Highway', 'Dam Road'].includes(e.name)) continue;
    const r0 = Math.hypot(S[0].x, S[0].z), r1 = Math.hypot(S[S.length - 1].x, S[S.length - 1].z); if (Math.min(r0, r1) > 700 || Math.max(r0, r1) < 80) continue;
    const s0 = ed.padA + 6, s1 = e.len - ed.padB - 6; if (s1 - s0 < 12) continue;
    for (let s = s0; s < s1; s += 6) {
      const sEnd = Math.min(s + 6, s1), pa = pointAt(S, s), pb = pointAt(S, sEnd), cx = (pa.x + pb.x) / 2, cz = (pa.z + pb.z) / 2; if (Math.hypot(cx, cz) < 78 || Math.hypot(cx, cz) > 720) continue;
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z), ang = Math.atan2(pb.x - pa.x, pb.z - pa.z), y = Math.max((pa.y + pb.y) / 2, terrainHeight(cx, cz)) + .2, w = A.at(cx, y, cz, ang);
      w.box(0, .12, 0, 1.3, .24, len + .05, conc, [.9, .9, .88], 'px nx py'); w.box(0, .245, 0, .94, .02, len, K.r('white'), [.3, .22, .15], 'py'); medians.push({x: cx, z: cz, y: y + .25, s});
    }
    for (let s = s0 + 10; s < s1 - 4; s += 42) {
      const p = pointAt(S, s), r = Math.hypot(p.x, p.z); if (r < 90 || r > 700 || isWater(p.x, p.z) || nearJunction(p.x, p.z, 2)) continue;
      const y = Math.max(p.y, terrainHeight(p.x, p.z)) + .45, rot = Math.atan2(-p.nz, p.nx), w = A.at(p.x, y, p.z, rot);
      w.cyl(0, 0, 0, .1, .06, 8.2, 6, metal, [.35, .36, .36]);
      for (const sx of [-1, 1]) { w.beam([0, 8.0, 0], [sx * 2.4, 8.35, 0], .09, metal, metalDark); w.use('sign').box(sx * 2.5, 8.3, 0, .3, .12, .6, K.S.glow, [.95, .95, .9], 'px nx py pz nz ny'); w.use('atlasS'); lamps.push({x: p.x + Math.cos(rot) * sx * 2.5, y: y + 8.2, z: p.z - Math.sin(rot) * sx * 2.5}); }
      collision.add({x: p.x, z: p.z, w: .3, d: .3, baseY: y, height: 8, kind: 'pole'});
    }
  }
  return {lamps, poles, busStops, wireMeshes, finishWires, addWire, signsPlaced, medians};
}
