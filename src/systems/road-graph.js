// Road graph: nodes at every junction / road end, edges = polyline stretches between nodes.
// Pure (no DOM, no renderer) so it can be unit-tested and shared by the road visuals and the traffic AI.
// Input is world-layout.js `roadChains` ({id,name,type,width,pts:[[x,z]..],ys:[..]}).
const CELL = 64, EPS_END = 1.2, MERGE = 3.2;

const segHit = (a, b, c, d) => {
  const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
  return t > 1e-4 && t < 1 - 1e-4 && u > 1e-4 && u < 1 - 1e-4 ? {t, u} : null;
};
const distToSeg = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return {d: Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t), t}; };

export function buildRoadGraph(chains, {minWidth = 2.5} = {}) {
  chains = chains.filter(c => c.width >= minWidth && c.pts.length > 1);
  const grid = new Map(), segs = [];
  for (const c of chains) for (let i = 0; i < c.pts.length - 1; i++) {
    const s = {c, i, a: c.pts[i], b: c.pts[i + 1]}; segs.push(s);
    for (let iz = Math.floor(Math.min(s.a[1], s.b[1]) / CELL); iz <= Math.floor(Math.max(s.a[1], s.b[1]) / CELL); iz++)
      for (let ix = Math.floor(Math.min(s.a[0], s.b[0]) / CELL); ix <= Math.floor(Math.max(s.a[0], s.b[0]) / CELL); ix++) { const k = ix + ':' + iz; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(s); }
  }
  const cuts = new Map(chains.map(c => [c.id, []])), addCut = (c, i, t, x, z) => cuts.get(c.id).push({pos: i + t, x, z}), seen = new Set();
  for (const list of grid.values()) for (const s of list) for (const o of list) {
    if (o.c === s.c || s.c.id > o.c.id) continue;
    const key = s.c.id + '|' + s.i + '|' + o.c.id + '|' + o.i; if (seen.has(key)) continue; seen.add(key);
    const h = segHit(s.a, s.b, o.a, o.b); if (!h) continue;
    const x = s.a[0] + (s.b[0] - s.a[0]) * h.t, z = s.a[1] + (s.b[1] - s.a[1]) * h.t;
    addCut(s.c, s.i, h.t, x, z); addCut(o.c, o.i, h.u, x, z);
  }
  for (const c of chains) for (const pi of [0, c.pts.length - 1]) {   // T-junctions: a chain end lying on another chain's segment
    const p = c.pts[pi], cx = Math.floor(p[0] / CELL), cz = Math.floor(p[1] / CELL); let best = null;
    for (const s of grid.get(cx + ':' + cz) || []) { if (s.c === c) continue; const q = distToSeg(p, s.a, s.b); if (q.d < EPS_END && (!best || q.d < best.d)) best = {...q, s}; }
    if (best && best.t > .001 && best.t < .999) addCut(best.s.c, best.s.i, best.t, p[0], p[1]);
  }
  const nodes = [], nodeGrid = new Map();
  const nodeAt = (x, z, y = 0) => {
    const cx = Math.floor(x / MERGE), cz = Math.floor(z / MERGE);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const n of nodeGrid.get((cx + dx) + ':' + (cz + dz)) || []) if (Math.hypot(n.x - x, n.z - z) < MERGE) return n;
    const n = {id: nodes.length, x, z, y, edges: []}; nodes.push(n); const k = cx + ':' + cz; let l = nodeGrid.get(k); if (!l) nodeGrid.set(k, l = []); l.push(n); return n;
  };
  const edges = [];
  for (const c of chains) {
    const list = cuts.get(c.id).sort((p, q) => p.pos - q.pos), last = c.pts.length - 1;
    const marks = [{pos: 0, x: c.pts[0][0], z: c.pts[0][1]}, ...list, {pos: last, x: c.pts[last][0], z: c.pts[last][1]}];
    const yAt = pos => { const i = Math.min(last - 1, Math.floor(pos)), t = pos - i; return c.ys[i] + (c.ys[i + 1] - c.ys[i]) * t; };
    for (let m = 0; m < marks.length - 1; m++) {
      const m0 = marks[m], m1 = marks[m + 1]; if (m1.pos - m0.pos < 1e-3) continue;
      const pts = [[m0.x, m0.z, yAt(m0.pos)]];
      for (let v = Math.floor(m0.pos) + 1; v <= Math.ceil(m1.pos) - 1; v++) if (v > m0.pos + 1e-3 && v < m1.pos - 1e-3) pts.push([c.pts[v][0], c.pts[v][1], c.ys[v]]);
      pts.push([m1.x, m1.z, yAt(m1.pos)]);
      let len = 0; const cum = [0]; for (let k = 1; k < pts.length; k++) { len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); cum.push(len); }
      if (len < .5) continue;
      const na = nodeAt(pts[0][0], pts[0][1], pts[0][2]), nb = nodeAt(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[pts.length - 1][2]);
      const e = {id: edges.length, a: na.id, b: nb.id, pts, cum, len, width: c.width, type: c.type, name: c.name, chain: c.id};
      edges.push(e); na.edges.push({e: e.id, end: 0}); nb.edges.push({e: e.id, end: 1});
    }
  }
  for (const n of nodes) { let sy = 0; for (const r of n.edges) { const e = edges[r.e]; sy += (r.end ? e.pts[e.pts.length - 1] : e.pts[0])[2]; } n.y = n.edges.length ? sy / n.edges.length : 0; }
  return {nodes, edges, chains};
}

/** Point + tangent at distance s along an edge (polyline). */
export function edgePoint(e, s, out = {}) {
  s = Math.max(0, Math.min(e.len, s)); let k = 1; while (k < e.cum.length - 1 && e.cum[k] < s) k++;
  const a = e.pts[k - 1], b = e.pts[k], l = e.cum[k] - e.cum[k - 1] || 1, t = (s - e.cum[k - 1]) / l, dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l;
  out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t; out.y = a[2] + (b[2] - a[2]) * t; out.tx = dx; out.tz = dz;
  return out;
}
export function reachable(graph, start) {
  const seen = new Set([start]), q = [start];
  while (q.length) { const n = graph.nodes[q.pop()]; for (const r of n.edges) { const e = graph.edges[r.e], o = r.end ? e.a : e.b; if (!seen.has(o)) { seen.add(o); q.push(o); } } }
  return seen;
}
