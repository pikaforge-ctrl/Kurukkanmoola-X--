import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTownHeadless} from './support/build-town.mjs';
import {createTraffic, yawFor} from '../src/systems/traffic.js';

// A stand-in vehicle: just enough surface for the AI (position, yaw, size, wheels).
const fakeVehicle = kind => ({mesh: {position: {x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }}, rotation: {y: 0}, visible: false}, wheels: [{rotation: {x: 0}}], length: kind === 'bus' ? 11 : kind === 'bike' ? 2 : 4, spec: {width: kind === 'bus' ? 2.5 : kind === 'bike' ? .7 : 1.8}, kind});

function simulate(world, {seconds = 240, dt = .05, player = {x: 120, z: 40}} = {}) {
  const {L, graph, field, collision} = world, hub = graph.nodes.find(n => Math.hypot(n.x, n.z) < 2);
  const traffic = createTraffic({scene: {add() {}}, graph, hub, createVehicle: fakeVehicle, surfaceHeight: L.surfaceHeight, size: 40, collision});
  const samples = {n: 0, headingOk: 0, onRoad: 0, leftOk: 0, leftN: 0, inSolid: 0, ringN: 0, ringOk: 0}, last = new Map(); let stuckMax = 0, t = 0;
  for (let step = 0; step < seconds / dt; step++) {
    t += dt; traffic.update(dt, player, [], {time: t, quality: 'medium'}); if (step % 10) continue;
    for (const v of traffic.vehicles) {
      const st = v.ai; if (!st.active) continue; const p = v.mesh.position, prev = last.get(v); stuckMax = Math.max(stuckMax, st.stuck);
      if (prev && st.speed > 1.5) {
        const dx = p.x - prev.x, dz = p.z - prev.z, l = Math.hypot(dx, dz);
        if (l > .3 && l < 6) { samples.n++; const fx = -Math.sin(v.mesh.rotation.y), fz = -Math.cos(v.mesh.rotation.y); if ((dx * fx + dz * fz) / l > .75) samples.headingOk++; }
        if (field.clearance(p.x, p.z) < .6) samples.onRoad++;
        if (collision.circleHits(p.x, p.z, .5, -Infinity, Infinity, ['wall', 'prop', 'tree', 'pole']) || collision.pointInside(p.x, p.z, null, ['building'])) samples.inSolid++;
        if (st.mode === 'edge' && st.blend >= 1 && st.e.width >= 6.4) {   // left-hand traffic: the vehicle sits on the LEFT of the centre line for its direction of travel
          const e = st.e, k = Math.max(0, Math.min(e.pts.length - 2, e.cum.findIndex(c => c >= st.s) - 1)), a = e.pts[k], b = e.pts[k + 1], tx = b[0] - a[0], tz = b[1] - a[1], ll = Math.hypot(tx, tz) || 1;
          const off = ((p.x - a[0]) * -tz + (p.z - a[1]) * tx) / ll, fwdLeft = st.dir > 0 ? -off : off; samples.leftN++; if (fwdLeft > .2) samples.leftOk++;
        }
        if (st.mode === 'ring') { samples.ringN++; const fx = -Math.sin(v.mesh.rotation.y), fz = -Math.cos(v.mesh.rotation.y), rx = p.x - hub.x, rz = p.z - hub.z, rl = Math.hypot(rx, rz) || 1; if ((fx * -rz + fz * rx) / rl > .6) samples.ringOk++; }
      }
      last.set(v, {x: p.x, z: p.z});
    }
  }
  return {samples, stuckMax, stats: traffic.stats()};
}

test('yaw convention: model front is -Z so forward (fx,fz) needs yaw atan2(-fx,-fz)', () => {
  for (const [fx, fz] of [[1, 0], [0, 1], [-1, 0], [0, -1], [.6, .8]]) { const y = yawFor(fx, fz); assert.ok(Math.abs(-Math.sin(y) - fx) < 1e-9 && Math.abs(-Math.cos(y) - fz) < 1e-9); }
});
const world = buildTownHeadless();
test('traffic: heading matches motion, stays on the carriageway, keeps left, never inside solids, never stuck', () => {
  const r = simulate(world, {seconds: 300}), s = r.samples;
  assert.ok(r.stats.active >= 12, 'vehicles spawned: ' + JSON.stringify(r.stats)); assert.ok(s.n > 800, 'enough moving samples ' + s.n);
  assert.ok(s.headingOk / s.n > .93, `heading vs motion ${(s.headingOk / s.n).toFixed(3)}`); assert.ok(s.onRoad / s.n > .9, `on carriageway ${(s.onRoad / s.n).toFixed(3)}`);
  assert.ok(s.leftN > 100 && s.leftOk / s.leftN > .95, `left-hand lane ${s.leftOk}/${s.leftN}`); assert.equal(s.inSolid, 0, 'vehicles inside solids'); assert.ok(r.stuckMax < 30, 'stuck time ' + r.stuckMax.toFixed(1));
  console.log('traffic sim', JSON.stringify({...s, stuckMax: r.stuckMax.toFixed(1)}));
});
test('traffic: the roundabout is one-way with the island on the vehicle\'s right', () => {
  const r = simulate(world, {seconds: 420, player: {x: 30, z: 20}});
  if (r.samples.ringN > 30) assert.ok(r.samples.ringOk / r.samples.ringN > .9, `ring ${r.samples.ringOk}/${r.samples.ringN}`);
});
