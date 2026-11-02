import test from 'node:test';
import assert from 'node:assert/strict';
import {CollisionWorld} from '../src/systems/collision.js';
import {RoadField} from '../src/systems/road-field.js';

test('circle vs rotated box: touching and clear cases', () => {
  const w = new CollisionWorld(); w.add({x: 0, z: 0, w: 10, d: 4, rot: Math.PI / 2, height: 8});   // rotated 90 deg: 4 along x, 10 along z
  assert.ok(w.circleHits(0, 4.8, .3), 'inside the long axis');
  assert.ok(!w.circleHits(4.8, 0, .3), 'outside the short axis');
  assert.ok(w.circleHits(2.2, 0, .3) && !w.circleHits(2.4, 0, .3));
});
test('vertical range: a first-floor wall does not block someone standing on a roof 20 m up', () => {
  const w = new CollisionWorld(); w.add({x: 0, z: 0, w: 4, d: 4, baseY: 0, height: 8});
  assert.ok(w.circleHits(0, 0, .3, 0, 2)); assert.ok(!w.circleHits(0, 0, .3, 20, 22));
});
test('pushOut moves a circle clear of a box and reports the hit', () => {
  const w = new CollisionWorld(); w.add({x: 0, z: 0, w: 4, d: 4, height: 8});
  const r = w.pushOut(1.5, .3, .5); assert.ok(r.hit); assert.ok(!w.circleHits(r.x, r.z, .49));
  assert.ok(!w.pushOut(9, 9, .5).hit);
});
test('overlapsBox: SAT with rotation and a negative margin lets touching boxes through', () => {
  const w = new CollisionWorld(); w.add({x: 0, z: 0, w: 6, d: 6, height: 5});
  assert.ok(w.overlapsBox(5, 0, 6, 6, 0, 0.1)); assert.ok(!w.overlapsBox(6.2, 0, 6, 6, 0, 0)); assert.ok(!w.overlapsBox(6, 0, 6, 6, 0, -.2));
  assert.ok(w.overlapsBox(4, 4, 4, 4, Math.PI / 4, 0));
});
test('rayDistance finds the first solid of an allowed kind only', () => {
  const w = new CollisionWorld(); w.add({x: 5, z: 0, w: 1, d: 6, baseY: 0, height: 5, kind: 'tree'}); w.add({x: 12, z: 0, w: 2, d: 6, baseY: 0, height: 5, kind: 'building'});
  const t = w.rayDistance(0, 1.5, 0, 1, 0, 0, 30, .25, ['building']); assert.ok(t > 10.5 && t < 11.5, 't=' + t); assert.ok(w.rayDistance(0, 1.5, 0, 1, 0, 0, 30) < 5);
});
test('RoadField clearance matches the exact distance to a road edge', () => {
  const f = new RoadField([{a: [0, 0], b: [100, 0], width: 8}], {minX: -50, maxX: 150, minZ: -50, maxZ: 50});
  assert.equal(Math.round(f.clearance(50, 0)), 0); assert.ok(Math.abs(f.clearance(50, 14) - 10) < .5); assert.ok(f.clearance(50, 45) >= 40);
});
