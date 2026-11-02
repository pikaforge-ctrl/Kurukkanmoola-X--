import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoadGraph, edgePoint, reachable} from '../src/systems/road-graph.js';
import {roadChains} from '../src/world-layout.js';

const chain = (id, pts, width = 6) => ({id, name: 'c' + id, type: 'residential', width, pts, ys: pts.map(() => 0)});
test('a crossing splits both roads into four edges around one degree-4 node', () => {
  const g = buildRoadGraph([chain(0, [[-50, 0], [50, 0]]), chain(1, [[0, -50], [0, 50]])]);
  assert.equal(g.edges.length, 4); assert.ok(g.nodes.some(n => n.edges.length === 4 && Math.hypot(n.x, n.z) < 1));
});
test('a T-junction (road ending on another) creates a degree-3 node', () => {
  const g = buildRoadGraph([chain(0, [[-50, 0], [50, 0]]), chain(1, [[0, 0.4], [0, 60]])]);
  assert.ok(g.nodes.some(n => n.edges.length === 3));
});
test('edgePoint walks the polyline with a unit tangent', () => {
  const g = buildRoadGraph([chain(0, [[0, 0], [30, 0], [30, 40]])]), e = g.edges[0], p = edgePoint(e, 45, {});
  assert.ok(Math.abs(p.x - 30) < 1e-6 && Math.abs(p.z - 15) < 1e-6); assert.ok(Math.abs(Math.hypot(p.tx, p.tz) - 1) < 1e-9);
});
test('the real world network is one connected component around the roundabout', () => {
  const g = buildRoadGraph(roadChains), hub = g.nodes.find(n => Math.hypot(n.x, n.z) < 2); assert.ok(hub && hub.edges.length >= 5, 'roundabout has arms');
  const seen = reachable(g, hub.id), frac = seen.size / g.nodes.length; assert.ok(frac > .9, 'connected fraction ' + frac.toFixed(3));
});
