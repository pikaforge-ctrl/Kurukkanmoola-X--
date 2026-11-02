import {terrainHeight, isWater, waterLevelAt} from '../world-layout.js';
import {scaleRGB} from '../kit/batcher.js';
import {mulberry32, clamp} from '../kit/util.js';

const TILE = 5;
export const roundaboutR = {inner: 33, outer: 45};

/** Samples along a polyline edge: position, left-normal (mitered), centre height, arc length. */
export function sampleEdge(e, step = 4) {
  const P = e.pts, n = P.length, seg = [];
  for (let i = 0; i < n - 1; i++) { const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1; seg.push({dx: dx / l, dz: dz / l, l}); }
  const vn = P.map((_, i) => {
    let tx = 0, tz = 0; if (i > 0) { tx += seg[i - 1].dx; tz += seg[i - 1].dz; } if (i < n - 1) { tx += seg[i].dx; tz += seg[i].dz; }
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const ref = i < n - 1 ? seg[i] : seg[i - 1];
    return {nx: -tz, nz: tx, m: 1 / Math.max(.55, tz * ref.dz + tx * ref.dx)};
  });
  const out = []; let s = 0;
  for (let i = 0; i < n - 1; i++) {
    const steps = Math.max(1, Math.ceil(seg[i].l / step));
    for (let k = 0; k < steps; k++) {
      const t = k / steps; let nx = vn[i].nx + (vn[i + 1].nx - vn[i].nx) * t, nz = vn[i].nz + (vn[i + 1].nz - vn[i].nz) * t; const nl = Math.hypot(nx, nz) || 1;
      out.push({x: P[i][0] + (P[i + 1][0] - P[i][0]) * t, z: P[i][1] + (P[i + 1][1] - P[i][1]) * t, y: P[i][2] + (P[i + 1][2] - P[i][2]) * t, nx: nx / nl, nz: nz / nl, m: vn[i].m + (vn[i + 1].m - vn[i].m) * t, s: s + seg[i].l * t, seg: i});
    }
    s += seg[i].l;
  }
  const L = n - 1; out.push({x: P[L][0], z: P[L][1], y: P[L][2], nx: vn[L].nx, nz: vn[L].nz, m: vn[L].m, s, seg: L - 1});
  return out;
}
export function pointAt(S, s) {
  s = clamp(s, 0, S[S.length - 1].s); let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid].s <= s) lo = mid; else hi = mid; }
  const a = S[lo], b = S[hi], t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0, nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t, nl = Math.hypot(nx, nz) || 1;
  return {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, nx: nx / nl, nz: nz / nl, m: a.m + (b.m - a.m) * t, s};
}
const P3 = (p, o, up) => { const x = p.x + p.nx * o * p.m, z = p.z + p.nz * o * p.m; return [x, Math.max(p.y, terrainHeight(x, z)) + up, z]; };

export const urbanAt = (x, z) => (x / 1450) ** 2 + (z / 1100) ** 2 < 1;
export const coreAt = (x, z) => (x / 1050) ** 2 + (z / 800) ** 2 < 1;

/** Builds every road layer. Returns {edgeData, junctions, crossings, bridgeDecks, nodeInfo, padOf}. */
export function buildRoads({B, K, graph, hub}) {
  const rnd = mulberry32(6061), W = B.world('road'), A = B.world('atlas'), AS = B.world('atlasS'), Mk = B.world('mark');
  const stone = K.r('stone'), conc = K.r('concrete'), white = K.r('white');
  const edgeData = [], crossings = [], junctions = [], bridgeDecks = []; let barrierCount = 0;
  const nodeInfo = graph.nodes.map(n => { const ws = n.edges.map(r => graph.edges[r.e].width), maxW = Math.max(0, ...ws); return {n, maxW, deg: n.edges.length, pad: n.edges.length >= 3 ? maxW * .5 + 2.4 : 0}; });
  const isHub = n => hub && Math.hypot(n.x - hub.x, n.z - hub.z) < 2;
  const padOf = n => (isHub(n) ? roundaboutR.outer : nodeInfo[n.id].pad);

  const ribbon = (mat, S, o0, o1, up, col, {uvScale = TILE, rect = null, skip = null} = {}) => {
    const wr = mat === 'road' ? W : mat === 'mark' ? Mk : mat === 'atlas' ? A : mat === 'atlasS' ? AS : B.world(mat);
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1]; if (skip && skip(a, b, i)) continue;
      const q0 = P3(a, o0, up), q1 = P3(a, o1, up), q2 = P3(b, o1, up), q3 = P3(b, o0, up), v0 = a.s / uvScale, v1 = b.s / uvScale, jitter = 1 + (rnd() - .5) * .06;
      wr.use(mat).quad(q0, q1, q2, q3, rect || [0, v0, (o1 - o0) / uvScale, v1], jitter === 1 ? col : scaleRGB(col, jitter));
    }
  };

  for (const e of graph.edges) {
    const nA = graph.nodes[e.a], nB = graph.nodes[e.b], padA = padOf(nA), padB = padOf(nB), w = e.width, t = e.type;
    const S = sampleEdge(e, t === 'hill' ? 4 : 8), mx = (nA.x + nB.x) / 2, mz = (nA.z + nB.z) / 2;
    const dirt = t === 'forest' || t === 'trail', lane = t === 'lane', hill = t === 'hill';
    const urban = !dirt && !hill && urbanAt(mx, mz), curbs = urban && w >= 4.6 && (coreAt(mx, mz) || w >= 6.4);
    const wetAt = (a, b) => isWater((a.x + b.x) / 2, (a.z + b.z) / 2) || (waterLevelAt(a.x, a.z) > a.y - 2.2 && isWater(a.x, a.z));
    const ed = {e, S, urban, curbs, padA, padB, wet: new Set()};
    for (let i = 0; i < S.length - 1; i++) if (wetAt(S[i], S[i + 1])) ed.wet.add(i);
    edgeData.push(ed);

    // ---- surface -------------------------------------------------------------------------------------------------
    if (dirt) ribbon('shoulder', S, -w / 2 - .8, w / 2 + .8, .14, [.62, .5, .4]);
    else if (lane) { ribbon('atlas', S, -w / 2, w / 2, .2, [.72, .72, .7], {rect: conc, uvScale: 4}); if (!curbs) { ribbon('shoulder', S, -w / 2 - 1.1, -w / 2, .11, [1, 1, 1]); ribbon('shoulder', S, w / 2, w / 2 + 1.1, .11, [1, 1, 1]); } }
    else { ribbon('road', S, -w / 2, w / 2, .2, t === 'highway' || t === 'primary' ? [1, 1, 1.02] : [.95, .93, .9]); if (!curbs) { ribbon('shoulder', S, -w / 2 - 1.1, -w / 2, .11, [1, 1, 1]); ribbon('shoulder', S, w / 2, w / 2 + 1.1, .11, [1, 1, 1]); } }

    // ---- pavements, kerbs, drains (urban only, never on bridges) --------------------------------------------------
    if (curbs && !dirt) {
      const notWet = (a, b, i) => ed.wet.has(i) || isWater(a.x, a.z);
      for (const side of [-1, 1]) {
        const o = side * (w / 2), sw = w >= 6.4 ? 2.3 : 1.6, so = side * (w / 2 + sw);
        for (let i = 0; i < S.length - 1; i++) {   // vertical kerb face
          const a = S[i], b = S[i + 1]; if (notWet(a, b, i)) continue;
          const pa = [a.x + a.nx * o * a.m, a.y, a.z + a.nz * o * a.m], pb = [b.x + b.nx * o * b.m, b.y, b.z + b.nz * o * b.m];
          const ya = Math.max(a.y, terrainHeight(pa[0], pa[2])), yb = Math.max(b.y, terrainHeight(pb[0], pb[2]));
          const q = side > 0 ? [[pa[0], ya + .2, pa[2]], [pb[0], yb + .2, pb[2]], [pb[0], yb + .38, pb[2]], [pa[0], ya + .38, pa[2]]] : [[pb[0], yb + .2, pb[2]], [pa[0], ya + .2, pa[2]], [pa[0], ya + .38, pa[2]], [pb[0], yb + .38, pb[2]]];
          AS.use('atlasS').quad(q[0], q[1], q[2], q[3], conc, [.82, .82, .8]);
        }
        ribbon('atlasS', S, Math.min(o, so), Math.max(o, so), .38, [.84, .8, .76], {skip: notWet, rect: stone, uvScale: 3});
      }
      if (w < 6.4) for (const side of [-1, 1]) ribbon('atlasS', S, side * (w / 2 + 1.6), side * (w / 2 + 2.2), .3, [.5, .5, .5], {rect: conc});
    } else if (urban && lane) for (const side of [-1, 1]) ribbon('atlasS', S, side * (w / 2 + .1), side * (w / 2 + .62), .15, [.45, .45, .44], {rect: conc, uvScale: 3});

    // ---- markings --------------------------------------------------------------------------------------------------
    if (!dirt && !lane && w >= 5.8 && e.len > padA + padB + 6) {
      const s0 = padA + .6, s1 = e.len - padB - .6, paint = [.93, .92, .86], yellow = [.95, .78, .12];
      const dash = (off, on, gap, width, col) => { for (let s = s0; s < s1; s += on + gap) { const b = Math.min(s + on, s1); if (b - s < .8) continue; const pa = pointAt(S, s), pb = pointAt(S, b); Mk.use('mark').quad(P3(pa, off - width / 2, .225), P3(pa, off + width / 2, .225), P3(pb, off + width / 2, .225), P3(pb, off - width / 2, .225), [0, s / 2, 1, b / 2], col); } };
      const solid = (off, width, col) => dash(off, 1e6, 0, width, col);
      if (t === 'highway') { solid(-.14, .12, yellow); solid(.14, .12, yellow); solid(-w / 2 + .45, .14, paint); solid(w / 2 - .45, .14, paint); }
      else if (t === 'primary' || (t === 'secondary' && w >= 7)) { dash(0, 3, 5, .13, paint); if (w >= 8) { solid(-w / 2 + .4, .12, paint); solid(w / 2 - .4, .12, paint); } }
      else if (t === 'secondary' || hill) dash(0, 2.6, 5, .12, paint);
      else dash(0, 2.2, 5.5, .11, paint);
    }
    // ---- zebra crossings next to important junctions --------------------------------------------------------------
    for (const [end, nd, pad] of [[0, nA, padA], [1, nB, padB]]) {
      const info = nodeInfo[nd.id]; if (dirt || lane || w < 5.5 || e.len < pad + 16) continue;
      const important = isHub(nd) ? true : info.deg >= 3 && info.maxW >= 6.4 && urbanAt(nd.x, nd.z) && rnd() < (coreAt(nd.x, nd.z) ? .9 : .45); if (!important) continue;
      const s0 = (end ? e.len - pad - 4.2 : pad + 1.4), pc = pointAt(S, s0 + 1.5), n = Math.floor((w - 1.4) / 1.05);
      for (let k = 0; k < n; k++) { const off = -w / 2 + .9 + k * ((w - 1.8) / Math.max(1, n - 1)), pa = pointAt(S, s0), pb = pointAt(S, s0 + 3); Mk.use('mark').quad(P3(pa, off - .26, .226), P3(pa, off + .26, .226), P3(pb, off + .26, .226), P3(pb, off - .26, .226), [0, 0, 1, 1], [.95, .95, .92]); }
      crossings.push({x: pc.x, z: pc.z, tx: -pc.nz, tz: pc.nx, width: w, edge: e.id, node: nd.id});
    }
    // ---- speed breakers on urban residential streets ---------------------------------------------------------------
    if (urban && !lane && w < 6.4 && e.len > 70 && rnd() < .35) {
      const s = e.len * (.35 + rnd() * .3);
      for (let k = 0; k < 6; k++) { const pa = pointAt(S, s + k * .6), pb = pointAt(S, s + k * .6 + .6); Mk.use('mark').quad(P3(pa, -w / 2, .235), P3(pa, w / 2, .235), P3(pb, w / 2, .235), P3(pb, -w / 2, .235), [0, 0, 1, 1], k % 2 ? [.12, .12, .12] : [.95, .8, .1]); }
    }
    // ---- crash barriers where a hill road runs along a drop (corrugated steel rail on posts) -------------------------
    if (hill && e.len > 40) for (const side of [-1, 1]) for (let i = 0; i < S.length - 1; i++) {
      if (barrierCount > 5200) break; const a = S[i], b = S[i + 1], off = side * (w / 2 + 1.0), pa = P3(a, off, 0), pb = P3(b, off, 0), out = P3(a, off + side * 5, 0);
      if (pa[1] - out[1] < 3.2 || isWater(a.x, a.z) || ed.wet.has(i)) continue;
      const y0 = Math.max(pa[1], terrainHeight(pa[0], pa[2])) + .2, y1 = Math.max(pb[1], terrainHeight(pb[0], pb[2])) + .2;
      const A0 = [pa[0], y0 + .5, pa[2]], B0 = [pb[0], y1 + .5, pb[2]], A1 = [pa[0], y0 + .85, pa[2]], B1 = [pb[0], y1 + .85, pb[2]], steel = K.r('metal'), col = [.62, .64, .66];
      if (side > 0) { AS.use('atlasS').quad(A0, B0, B1, A1, steel, col); AS.use('atlasS').quad(B0, A0, A1, B1, steel, scaleRGB(col, .8)); } else { AS.use('atlasS').quad(B0, A0, A1, B1, steel, col); AS.use('atlasS').quad(A0, B0, B1, A1, steel, scaleRGB(col, .8)); }
      AS.at(pa[0], y0, pa[2], 0, 'atlasS').box(0, .45, 0, .09, .9, .09, steel, [.5, .5, .52], 'px nx pz nz'); barrierCount++;
    }
    // ---- bridges: concrete deck, parapets with rails and piers -----------------------------------------------------
    for (const i of ed.wet) {
      const a = S[i], b = S[i + 1], mx2 = (a.x + b.x) / 2, mz2 = (a.z + b.z) / 2, len = Math.hypot(b.x - a.x, b.z - a.z), h = (a.y + b.y) / 2, ang = Math.atan2(b.x - a.x, b.z - a.z), g = A.at(mx2, h, mz2, ang, 'atlas');
      K.boxT(g, 0, -.55, 0, w + .6, 1.0, len + .15, 'concrete', [.72, .72, .7], 'px nx pz nz ny py', 3);
      for (const side of [-1, 1]) { const ox = side * (w / 2 + .18); g.box(ox, .25, 0, .32, .55, len + .1, conc, [.88, .88, .86], 'px nx py pz nz'); g.box(ox, 1.0, 0, .12, .1, len + .1, conc, [.9, .9, .88], 'px nx py'); for (let z = -len / 2; z <= len / 2 + .01; z += 3) g.box(ox, .65, z, .16, .9, .16, conc, [.92, .92, .9], 'px nx pz nz py'); }
      if (bridgeDecks.length % 3 === 0) for (const side of [-1, 1]) { const dh = Math.max(2, h - waterLevelAt(mx2, mz2) + 5); g.box(side * (w / 2 - 1), -dh / 2 - .3, 0, .8, dh, 1.8, K.r('plinth'), [.7, .72, .76], 'px nx pz nz'); }
      bridgeDecks.push({x: mx2, z: mz2, y: h});
    }
  }

  // ---- junction pads (hide ribbon seams, give real tarmac squares at T/X junctions) ----------------------------------
  for (const info of nodeInfo) {
    const n = info.n; if (info.deg < 3 || isHub(n) || info.maxW < 3) continue;
    if (n.edges.every(r => ['forest', 'trail'].includes(graph.edges[r.e].type)) || isWater(n.x, n.z)) continue;
    const laneOnly = n.edges.every(r => graph.edges[r.e].type === 'lane'), r = info.pad - .3, y = Math.max(n.y, terrainHeight(n.x, n.z)) + .212, seg = 14;
    const cuv = [(conc[0] + conc[2]) / 2, (conc[1] + conc[3]) / 2], mat = laneOnly ? 'atlas' : 'roadPad', col = laneOnly ? [.7, .7, .68] : [.95, .93, .9], wr = B.world(mat);
    for (let k = 0; k < seg; k++) {
      const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, h0 = Math.max(y, terrainHeight(n.x + Math.cos(a0) * r, n.z + Math.sin(a0) * r) + .21), h1 = Math.max(y, terrainHeight(n.x + Math.cos(a1) * r, n.z + Math.sin(a1) * r) + .21);
      const p0 = [n.x, y, n.z], p1 = [n.x + Math.cos(a0) * r, h0, n.z + Math.sin(a0) * r], p2 = [n.x + Math.cos(a1) * r, h1, n.z + Math.sin(a1) * r];
      if (laneOnly) wr.use(mat).tri(p0, p2, p1, cuv, cuv, cuv, col); else wr.use(mat).tri(p0, p2, p1, [n.x / 5, n.z / 5], [p2[0] / 5, p2[2] / 5], [p1[0] / 5, p1[2] / 5], col);
    }
    junctions.push({x: n.x, z: n.z, r, deg: info.deg, maxW: info.maxW, node: n.id});
  }

  // ---- roundabout ring (annulus), lane line, painted kerb ring and the island top ------------------------------------
  const cx = hub ? hub.x : 0, cz = hub ? hub.z : 0, townY = Math.max(hub ? hub.y : terrainHeight(0, 0), terrainHeight(0, 0)), wuv = [(white[0] + white[2]) / 2, (white[1] + white[3]) / 2];
  for (let k = 0; k < 96; k++) {
    const a0 = k / 96 * Math.PI * 2, a1 = (k + 1) / 96 * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1), R0 = roundaboutR.inner, R1 = roundaboutR.outer, y = townY + .24;
    W.use('road').quad([cx + c0 * R0, y, cz + s0 * R0], [cx + c0 * R1, y, cz + s0 * R1], [cx + c1 * R1, y, cz + s1 * R1], [cx + c1 * R0, y, cz + s1 * R0], [k % 4, 0, k % 4 + 1, 1], [.95, .93, .9]);
    if (k % 2 === 0) { const Rm = (R0 + R1) / 2, y2 = y + .012; Mk.use('mark').quad([cx + c0 * (Rm - .07), y2, cz + s0 * (Rm - .07)], [cx + c0 * (Rm + .07), y2, cz + s0 * (Rm + .07)], [cx + c1 * (Rm + .07), y2, cz + s1 * (Rm + .07)], [cx + c1 * (Rm - .07), y2, cz + s1 * (Rm - .07)], [0, 0, 1, 1], [.93, .92, .86]); }
    const g = A.at(cx + (c0 + c1) / 2 * (R0 - .2), townY + .32, cz + (s0 + s1) / 2 * (R0 - .2), -(a0 + a1) / 2, 'atlas');
    g.box(0, 0, 0, .5, .34, 2 * Math.PI * R0 / 96 + .12, conc, k % 4 < 2 ? [.9, .9, .88] : [.95, .8, .12], 'px nx py');
    const tri = [[cx, townY + .3, cz], [cx + c0 * (R0 - .45), townY + .3, cz + s0 * (R0 - .45)], [cx + c1 * (R0 - .45), townY + .3, cz + s1 * (R0 - .45)]];
    A.use('atlas').tri(tri[0], tri[2], tri[1], wuv, wuv, wuv, [.26, .46, .2]);
  }
  return {edgeData, junctions, crossings, bridgeDecks, nodeInfo, padOf};
}
