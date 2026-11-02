import {edgePoint} from './road-graph.js';
import {mulberry32, clamp} from '../kit/util.js';

/**
 * Kerala traffic. Drives on the LEFT; vehicles are pooled, only a few dozen exist around the player and they are recycled as the
 * player moves. Conventions (verified in tests/traffic.test.mjs):
 *   forward = (fx, fz)    left of travel = (fz, -fx)    yaw = atan2(-fx, -fz)   (vehicle models face local -Z)
 * The old traffic code used yaw = atan2(dx,-dz), which makes vehicles face the mirrored direction on x-heavy roads.
 */
export const yawFor = (fx, fz) => Math.atan2(-fx, -fz);

const MIX = [['hatch', 5], ['taxi', 3], ['suv', 2], ['jeep', 1.4], ['van', 2], ['mini', 1.4], ['auto', 7.5], ['bus', 1.6], ['swift', 1.6], ['private', 1.6], ['truck', 2], ['load', 1.5], ['goodsauto', 2], ['garbage', .4], ['tanker', .4], ['bike', 7], ['scooter', 6], ['moped', 3], ['tractor', .35], ['sport', .5]];
const TOP = {bus: .85, swift: .95, private: .9, truck: .8, load: .75, tanker: .7, garbage: .6, tractor: .35, auto: .85, goodsauto: .8, bike: 1.05, scooter: .95, moped: .8, sport: 1.15};
const SPEED = {highway: 16, primary: 13, secondary: 10.5, residential: 7, lane: 4.8, hill: 10};
const pickW = (r, t) => { let x = r() * t.reduce((s, e) => s + e[1], 0); for (const [k, w] of t) { x -= w; if (x <= 0) return k; } return t[0][0]; };
const RING_R = 39, ARM_R = 47.5;
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// counter-clockwise angular distance from a to b (0..2pi): the direction the ring turns
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d < 0) d += Math.PI * 2; return d; };

export function createTraffic({scene, graph, hub, createVehicle, surfaceHeight, size = 48, collision = null}) {
  const rnd = mulberry32(8080), edges = graph.edges, nodes = graph.nodes;
  const drivable = edges.filter(e => !['forest', 'trail'].includes(e.type) && e.width >= 3.2 && e.len > 14), isDrive = new Set(drivable.map(e => e.id));
  const out = nodes.map(n => n.edges.filter(r => isDrive.has(r.e)).map(r => ({e: edges[r.e], dir: r.end === 0 ? 1 : -1})));
  // roundabout arms: the usable stretch starts where the edge leaves the ring road
  const arms = [], armOf = new Map();
  if (hub) for (const r of hub.edges) {
    const e = edges[r.e]; if (!isDrive.has(e.id)) continue;
    const hubEnd = r.end; let s = 0; const cum = e.cum;
    for (let k = 1; k < e.pts.length; k++) { const p = hubEnd ? e.pts[e.pts.length - 1 - k] : e.pts[k]; if (Math.hypot(p[0] - hub.x, p[1] - hub.z) > ARM_R) { s = hubEnd ? e.len - cum[e.pts.length - 1 - k] : cum[k]; break; } }
    const pt = edgePoint(e, hubEnd ? e.len - Math.max(s, 1) : Math.max(s, 1), {}), a = {e, hubEnd, sMin: Math.max(1, s), angle: Math.atan2(pt.z - hub.z, pt.x - hub.x)}; arms.push(a); armOf.set(e.id, a);
  }
  arms.sort((a, b) => a.angle - b.angle);
  const hubId = hub ? hub.id : -1, lanes = e => clamp(e.width * .26, .9, 2.0);

  const pool = [];
  for (let i = 0; i < size; i++) {
    const kind = pickW(rnd, MIX), v = createVehicle(kind); v.mesh.visible = false; v.mesh.position.set(0, -1000, 0); scene.add(v.mesh);
    v.ai = {active: false, mode: 'edge', e: null, dir: 1, s: 0, speed: 0, vmax: 10, lane: 1.5, from: null, via: null, blend: 1, wait: 0, stuck: 0, idle: 0, yaw: 0, ringA: 0, exitArm: null, fx: 1, fz: 0, kind, personality: rnd.range(.82, 1.12) * (TOP[kind] || 1), slot: i, turn: 1};
    pool.push(v);
  }
  const nodeRes = new Map();
  const reserve = (n, v, edgeId, t) => { let m = nodeRes.get(n); if (!m) nodeRes.set(n, m = new Map()); if (!m.has(v)) m.set(v, {edge: edgeId, t}); };
  const release = (n, v) => { const m = nodeRes.get(n); if (m) m.delete(v); };
  const prio = e => e.width + (e.type === 'highway' ? 4 : 0);
  const place = (v, x, z, fx, fz) => { const st = v.ai; v.mesh.position.set(x, surfaceHeight(x, z), z); st.fx = fx; st.fz = fz; st.yaw += wrap(yawFor(fx, fz) - st.yaw) * Math.min(1, st.turn); v.mesh.rotation.y = st.yaw; };
  const enterEdge = (v, e, dir, s0, fromPos = null, via = null) => {
    const st = v.ai; st.via = via; st.mode = 'edge'; st.e = e; st.dir = dir; st.s = s0; st.lane = lanes(e) * (['bike', 'scooter', 'moped'].includes(v.kind) ? 1.18 : 1);
    st.vmax = (SPEED[e.type] || 8) * st.personality; st.from = fromPos; st.blend = fromPos ? 0 : 1; st.wait = 0;
  };
  const lanePos = (st, tmp) => { const p = edgePoint(st.e, st.s, tmp), fx = p.tx * st.dir, fz = p.tz * st.dir; tmp.fx = fx; tmp.fz = fz; tmp.px = p.x + fz * st.lane; tmp.pz = p.z - fx * st.lane; return tmp; };

  function spawn(v, camPos, qualityRange) {
    const st = v.ai;
    for (let attempt = 0; attempt < 40; attempt++) {
      const e = drivable[(rnd() * drivable.length) | 0]; if (rnd() * 14 > e.width) continue;
      const s = rnd() * e.len, p = edgePoint(e, s, {}), d = Math.hypot(p.x - camPos.x, p.z - camPos.z); if (d < 110 || d > qualityRange) continue;
      const a = armOf.get(e.id); if (a && (a.hubEnd ? s > e.len - a.sMin - 6 : s < a.sMin + 6)) continue;
      const dir = rnd() < .5 ? 1 : -1; st.active = true; st.idle = 0; st.stuck = 0; st.speed = 0; enterEdge(v, e, dir, s); const q = lanePos(st, {});
      let clash = false; for (const o of pool) if (o !== v && o.ai.active && Math.hypot(o.mesh.position.x - q.px, o.mesh.position.z - q.pz) < 13) { clash = true; break; }
      if (clash) { st.active = false; continue; }
      st.yaw = yawFor(q.fx, q.fz); st.speed = st.vmax * .6; v.mesh.visible = true; st.turn = 1; place(v, q.px, q.pz, q.fx, q.fz); return true;
    }
    return false;
  }
  const despawn = v => { const st = v.ai; st.active = false; v.mesh.visible = false; v.mesh.position.set(0, -1000, 0); for (const m of nodeRes.values()) m.delete(v); };
  function chooseNext(nodeId, from, st) {
    const opts = out[nodeId].filter(o => o.e !== from); if (!opts.length) return null;
    const p = edgePoint(from, st.dir > 0 ? from.len : 0, {}), fx = p.tx * st.dir, fz = p.tz * st.dir; let tot = 0;
    const ws = opts.map(o => { const q = edgePoint(o.e, o.dir > 0 ? .5 : o.e.len - .5, {}), nx = q.tx * o.dir, nz = q.tz * o.dir, dot = fx * nx + fz * nz; o.turn = fx * nz - fz * nx; const w = o.e.width * (dot > .5 ? 1.5 : dot < -.7 ? .15 : 1); tot += w; return w; });
    let r = rnd() * tot, k = 0; for (; k < ws.length - 1; k++) { r -= ws[k]; if (r <= 0) break; } return opts[k];
  }
  const pickExit = from => { const options = arms.filter(a => a !== from); return options[(rnd() * options.length) | 0] || from; };

  let spawnTimer = 0;
  function update(dt, player, obstacles, opts = {}) {
    const quality = opts.quality || 'medium', target = quality === 'low' ? 16 : quality === 'high' ? 44 : 28, range = quality === 'low' ? 360 : quality === 'high' ? 640 : 500, rainK = opts.rain ? .72 : 1, nightK = opts.night ? .88 : 1;
    spawnTimer -= dt; let active = 0; for (const v of pool) if (v.ai.active) active++;
    if (spawnTimer <= 0) { spawnTimer = .35; for (const v of pool) { if (!v.ai.active) { if (active < target && spawn(v, player, range)) active++; } else if (Math.hypot(v.mesh.position.x - player.x, v.mesh.position.z - player.z) > range + 140 || v.ai.stuck > 22) { despawn(v); active--; } } }
    const act = pool.filter(v => v.ai.active), tmp = {};
    for (const v of act) {
      const st = v.ai, e = st.e, pos = v.mesh.position; let want = st.vmax * rainK * nightK;
      if (st.mode === 'edge') {
        const lp = lanePos(st, tmp), fx = lp.fx, fz = lp.fz, a = armOf.get(e.id);
        const sEnd = st.dir > 0 ? (a && a.hubEnd ? e.len - a.sMin : e.len) : (a && !a.hubEnd ? a.sMin : 0), toEnd = st.dir > 0 ? sEnd - st.s : st.s - sEnd;
        const nodeId = st.dir > 0 ? e.b : e.a, atHub = a && ((st.dir > 0) === (a.hubEnd === 1));
        let gap = 1e9, leadSpeed = 0;   // leaders: vehicles, pedestrians, the player
        for (const o of act) { if (o === v) continue; const dx = o.mesh.position.x - pos.x, dz = o.mesh.position.z - pos.z, ahead = dx * fx + dz * fz; if (ahead < 0 || ahead > 40) continue; const lat = Math.abs(dx * fz - dz * fx); if (lat > 2.3 + st.lane * .3) continue; if (o.ai.fx * fx + o.ai.fz * fz < -.3 && o.ai.speed > .5) continue; const g = ahead - (v.length + o.length) * .5; if (g < gap) { gap = g; leadSpeed = o.ai.speed * (o.ai.fx * fx + o.ai.fz * fz > 0 ? 1 : 0); } }
        for (const ob of obstacles) { const dx = ob.x - pos.x, dz = ob.z - pos.z, ahead = dx * fx + dz * fz; if (ahead < -.5 || ahead > 30) continue; const lat = Math.abs(dx * fz - dz * fx); if (lat > ob.r + 1.2 + v.spec.width * .5) continue; const g = ahead - v.length * .5 - ob.r; if (g < gap) { gap = g; leadSpeed = 0; } }
        if (gap < 1e8) { const safe = Math.max(0, gap - 2.4) * 1.1; want = Math.min(want, Math.max(leadSpeed * .9, Math.min(want, safe))); if (gap < 3.2) want = Math.min(want, leadSpeed * .5); }
        if (toEnd < 40 && !atHub && nodes[nodeId].edges.length >= 3) {   // junction approach: slow, give way by road hierarchy, then reserve the node
          const nxt = st.next || (st.next = chooseNext(nodeId, e, st)), turny = nxt ? Math.abs(nxt.turn) : 0;
          if (toEnd < 22) want = Math.min(want, 3.8 + turny * 2.2);
          if (toEnd < 16 && toEnd > 3) {
            const m = nodeRes.get(nodeId); let mustWait = false;
            if (m) for (const [o, r] of m) { if (o === v || !o.ai.active || r.edge === e.id) continue; if (prio(edges[r.edge]) > prio(e) || (prio(edges[r.edge]) === prio(e) && r.t < opts.time - .5)) { mustWait = true; break; } }
            if (mustWait && st.wait < 7) { st.wait += dt; want = 0; } else if (toEnd < 12) reserve(nodeId, v, e.id, opts.time);
          }
        }
        if (atHub && toEnd < 30) { want = Math.min(want, 5 + Math.max(0, toEnd - 6) * .25); const m = nodeRes.get(hubId); if (toEnd < 14 && m) for (const [o] of m) if (o !== v && o.ai.active && o.ai.mode === 'ring' && angDiff(o.ai.ringA, a.angle) < .9 && st.wait < 6) { want = 0; st.wait += dt; } }
        const acc = want > st.speed ? 2.6 : 7.5; st.speed += clamp(want - st.speed, -acc * dt, acc * dt); if (st.speed < .05 && want === 0) st.speed = 0;
        const ds = st.speed * dt; st.s += st.dir * ds; if (st.blend < 1) st.blend = Math.min(1, st.blend + ds / 11);
        if (st.speed < .25 && want < .3) { st.idle += dt; if (!(st.wait > 0)) st.stuck += dt; } else { st.idle = 0; st.stuck = Math.max(0, st.stuck - dt * 2); }
        if ((st.dir > 0 && st.s >= sEnd) || (st.dir < 0 && st.s <= sEnd)) {   // reached the end of the edge
          if (atHub) { const q = lanePos(st, {}); st.mode = 'ring'; st.ringA = Math.atan2(q.pz - hub.z, q.px - hub.x); st.exitArm = pickExit(a); st.from = [q.px, q.pz]; st.via = null; st.blend = 0; st.ringLane = RING_R + (st.slot % 2 ? 2.2 : -2.2); reserve(hubId, v, e.id, opts.time); st.next = null; continue; }
          release(nodeId, v); const nxt = st.next || chooseNext(nodeId, e, st); st.next = null; const q = lanePos(st, {});
          if (!nxt) { st.dir = -st.dir; st.s = clamp(st.s, 0, e.len); st.from = [q.px, q.pz]; st.via = null; st.blend = 0; continue; }
          enterEdge(v, nxt.e, nxt.dir, nxt.dir > 0 ? .02 : nxt.e.len - .02, [q.px, q.pz], [nodes[nodeId].x, nodes[nodeId].z]);
          const hubEdge = armOf.get(nxt.e.id); if (hubEdge && ((nxt.dir > 0) === (hubEdge.hubEnd === 1))) st.s = nxt.dir > 0 ? nxt.e.len - hubEdge.sMin - .5 : hubEdge.sMin + .5;
        }
        const lp2 = lanePos(st, tmp); let px = lp2.px, pz = lp2.pz;   // placement: blend lanes through the junction (Bezier via the node centre) so cars cut the corner smoothly
        if (st.blend < 1 && st.from) {
          if (st.via) { const k = st.blend, u = 1 - k; px = u * u * st.from[0] + 2 * u * k * st.via[0] + k * k * px; pz = u * u * st.from[1] + 2 * u * k * st.via[1] + k * k * pz; }
          else { const k = st.blend * st.blend * (3 - 2 * st.blend); px = st.from[0] + (px - st.from[0]) * k; pz = st.from[1] + (pz - st.from[1]) * k; }
        }
        if (st.blend < 1 && collision && collision.circleHits(px, pz, .85)) { st.blend = 1; px = lp2.px; pz = lp2.pz; }
        const hx = px - pos.x, hz = pz - pos.z, hl = Math.hypot(hx, hz); st.turn = Math.min(1, dt * 7); if (hl > .02) place(v, px, pz, hx / hl, hz / hl); else place(v, px, pz, lp2.fx, lp2.fz);
      } else {   // roundabout: one way, island on the right-hand side
        const R = st.ringLane || RING_R; want = Math.min(want, 6.2);
        let gap = 1e9; for (const o of act) { if (o === v || o.ai.mode !== 'ring') continue; const da = angDiff(st.ringA, o.ai.ringA); if (da > 0 && da < .7) gap = Math.min(gap, da * R - 5); }
        if (gap < 1e8) want = Math.min(want, Math.max(0, (gap - 2) * .9));
        for (const ob of obstacles) { const dx = ob.x - pos.x, dz = ob.z - pos.z, fx = -Math.sin(st.ringA), fz = Math.cos(st.ringA), ahead = dx * fx + dz * fz; if (ahead > 0 && ahead < 14 && Math.abs(dx * fz - dz * fx) < ob.r + 2) want = Math.min(want, Math.max(0, (ahead - ob.r - 4) * .8)); }
        const acc = want > st.speed ? 2.4 : 7; st.speed += clamp(want - st.speed, -acc * dt, acc * dt); const ds = st.speed * dt; st.ringA += ds / R; if (st.blend < 1) st.blend = Math.min(1, st.blend + ds / 10);
        if (st.speed < .2 && want < .3) st.stuck += dt; else st.stuck = Math.max(0, st.stuck - dt * 2);
        let px = hub.x + Math.cos(st.ringA) * R, pz = hub.z + Math.sin(st.ringA) * R;
        if (st.blend < 1 && st.from) { const k = st.blend * st.blend * (3 - 2 * st.blend); px = st.from[0] + (px - st.from[0]) * k; pz = st.from[1] + (pz - st.from[1]) * k; }
        const hx = px - pos.x, hz = pz - pos.z, hl = Math.hypot(hx, hz); st.turn = Math.min(1, dt * 7); if (hl > .02) place(v, px, pz, hx / hl, hz / hl);
        const ex = st.exitArm;
        if (ex && angDiff(st.ringA, ex.angle) < Math.max(.03, ds / R * 1.5)) { release(hubId, v); const dir = ex.hubEnd === 0 ? 1 : -1; enterEdge(v, ex.e, dir, dir > 0 ? ex.sMin + .5 : ex.e.len - ex.sMin - .5, [pos.x, pos.z]); st.exitArm = null; }
      }
      const spin = st.speed * dt / .36; for (const w of v.wheels || []) w.rotation.x -= spin;
    }
  }
  return {vehicles: pool, update, arms, drivable, despawnAll: () => pool.forEach(despawn), stats: () => ({active: pool.filter(v => v.ai.active).length, pool: pool.length})};
}
