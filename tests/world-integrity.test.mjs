import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTownHeadless} from './support/build-town.mjs';

const w = buildTownHeadless(), {town, collision, field, L} = w;
const buildings = collision.all.filter(c => c.kind === 'building');

test('town: enough buildings, a commercial core of shop rows and the required landmarks', () => {
  assert.ok(town.placed.length > 2000, 'buildings ' + town.placed.length);
  const core = town.placed.filter(p => Math.hypot(p.x, p.z * 1.3) < 430), shops = core.filter(p => p.type === 'shopHouse').length;
  assert.ok(shops / core.length > .6, `core shop share ${(shops / core.length).toFixed(2)}`);
  for (const k of ['college', 'hotel', 'padma', 'calicut']) assert.ok(town.landmarkRecs[k], 'landmark ' + k);
  assert.ok(town.teaShops.length >= 9, 'tea shops ' + town.teaShops.length); assert.ok(town.bus, 'bus & taxi stand'); assert.ok(town.jobSites.length >= 6, 'job sites kept: ' + town.jobSites.length);
  for (const t of ['temple', 'church', 'mosque', 'petrol', 'supermarket', 'hotel']) assert.ok(town.placed.some(p => p.type === t), t);
});
test('no building footprint sits on a carriageway or in water', () => {
  let onRoad = 0, wet = 0;
  for (const b of buildings) for (const [lx, lz] of [[0, 0], [-b.hw, -b.hd], [b.hw, -b.hd], [-b.hw, b.hd], [b.hw, b.hd]]) {
    const x = b.cx + lx * b.c + lz * b.s, z = b.cz - lx * b.s + lz * b.c; if (field.clearance(x, z) < .5) onRoad++; if (L.isWater(x, z)) wet++;
  }
  assert.equal(onRoad, 0, 'footprint corners on carriageway'); assert.ok(wet <= 40, 'footprint corners in water ' + wet);   // a few island huts sit on shoreline cells
});
test('buildings do not overlap each other (oriented-box SAT; shop rows may touch)', () => {
  const sat = (a, b, k) => {   // boxes shrunk by k on every side
    const dx = b.cx - a.cx, dz = b.cz - a.cz;
    for (const [ux, uz] of [[a.c, -a.s], [a.s, a.c], [b.c, -b.s], [b.s, b.c]]) {
      const ra = (a.hw - k) * Math.abs(a.c * ux - a.s * uz) + (a.hd - k) * Math.abs(a.s * ux + a.c * uz), rb = (b.hw - k) * Math.abs(b.c * ux - b.s * uz) + (b.hd - k) * Math.abs(b.s * ux + b.c * uz);
      if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
    }
    return true;
  };
  let pairs = 0, overlaps = 0;
  for (const a of buildings) for (const b of collision.candidates(a.cx - 40, a.cx + 40, a.cz - 40, a.cz + 40)) { if (b === a || b.kind !== 'building' || b.cx < a.cx || (b.cx === a.cx && b.cz <= a.cz)) continue; pairs++; if (sat(a, b, .35)) overlaps++; }
  assert.ok(pairs > 3000, 'pairs examined ' + pairs); assert.equal(overlaps, 0, 'overlapping building pairs');
});
test('every tea shop has a door facing a free spot and unique ids', () => {
  const ids = new Set(town.teaShops.map(t => t.id)); assert.equal(ids.size, town.teaShops.length);
  for (const t of town.teaShops) { const x = t.x + Math.sin(t.yaw) * 1.7, z = t.z + Math.cos(t.yaw) * 1.7; assert.ok(!collision.circleHits(x, z, .3), `tea shop ${t.id} exit point is free`); }
});
test('poles, lamps and shelters keep off the carriageway', () => {
  const bad = w.roadside.poles.filter(p => field.clearance(p.x, p.z) < .3).length + w.roadside.busStops.filter(s => field.clearance(s.x, s.z) < .5).length;
  assert.equal(bad, 0);
});
