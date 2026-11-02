import {pointAt} from './roads-core.js';
import {mulberry32, clamp} from '../kit/util.js';

const faceYaw = (dx, dz) => Math.atan2(-dx, -dz);          // models face local -Z
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const ROLE_LINES = {
  waiter: [['Bus passenger', 'The KSRTC is always five minutes late, which means it is on time.'], ['Commuter', 'If you are going to the hills, take the Mountain Road bus.'], ['Student', 'Tuition at five, then the evening bus home.']],
  walker: [['Shopper', 'The bazaar is busiest after the four o\'clock bus.'], ['Resident', 'Keep to the left side of the road, the buses do not wait.'], ['Teacher', 'The college campus is east of town, past the supermarket.'], ['Vendor', 'Fresh fish arrives at the market before sunrise.']],
  stander: [['Shopkeeper', 'Come in, come in. We have everything from rice to radios.'], ['Customer', 'Tea is ten rupees at the chaya kada, the best deal in town.'], ['Auto driver', 'Need a ride? Ask at the stand near the roundabout.'], ['Local', 'Mind the speed breakers, they are painted yellow.']],
  sitter: [['Tea drinker', 'Nothing beats a hot chaya and a parippu vada in the rain.'], ['Newspaper reader', 'Have you read today\'s paper? Monsoon is early again.'], ['Old farmer', 'I have been sitting on this bench for forty years.']],
  home: [['Homeowner', 'Welcome. The banana plants grow faster than the children.'], ['Neighbour', 'The coconut trees are older than this road.'], ['Grandmother', 'Take some jackfruit chips before you go.']],
};
const LANDMARK_LINES = {police: ['Traffic officer', 'Keep left and follow the main roads. The roundabout goes clockwise.'], priest: ['Temple priest', 'The temple district is south of the town centre.'], student: ['College student', 'The N.S.S. Hindu College campus is east of town.'], fisherman: ['Fisherman', 'The southern backwaters have jetties and islands.'], doctor: ['Doctor', 'Clinics are near the east town road. Drink more water.'], driver: ['Bus conductor', 'The bus route connects the hills, town and backwaters.']};

/** Waiters, sitters, shop-front standers, residents, named landmark roles, pooled pavement walkers and zebra-crossing pedestrians. */
export function createNpcLife({scene, createPerson, graph, edgeData, crossings, busStops, town, collision, field, surfaceHeight, trafficVehicles, hub, extraSpots = [], walkerCount = 12, crosserCount = 4, npcs = []}) {
  const R = mulberry32(2468), fixed = [], tmp = {}, female = () => R() < .42;
  const make = (role, archetype, name, words, female_ = female()) => { const p = createPerson(role, female_); p.name = name; p.words = words; p.archetype = archetype; p.role = role; p.phase = R() * 6.28; p.speed = 0; p.state = 'idle'; scene.add(p.mesh); npcs.push(p); return p; };
  const roleFor = () => R.pick(['resident', 'worker', 'student', 'traveller', 'resident']), lineFor = k => R.pick(ROLE_LINES[k]);
  const put = (p, x, z, yaw, y = null) => { p.mesh.position.set(x, y ?? surfaceHeight(x, z), z); p.mesh.rotation.y = yaw; };
  const spotOk = (x, z, r = .4) => field.clearance(x, z) > .3 && !collision.circleHits(x, z, r);
  const local = (b, lx, lz) => [b.x + lx * Math.cos(b.rot) + lz * Math.sin(b.rot), b.z - lx * Math.sin(b.rot) + lz * Math.cos(b.rot)];

  for (const bs of busStops) for (let k = 0, n = R.int(0, 2); k < n; k++) {   // waiting for the bus
    const [x, z] = local({x: bs.x, z: bs.z, rot: bs.rot}, (k ? 1 : -1) * R.range(.5, 1.1), R.range(.1, .5)); if (!spotOk(x, z, .3)) continue;
    const [n_, w] = lineFor('waiter'), p = make(roleFor(), 'waiter', n_, w); put(p, x, z, bs.rot + Math.PI + R.range(-.3, .3)); p.state = 'wait'; fixed.push(p);
  }
  for (const t of town.teaShops) for (const sx of [-.7, .7]) {   // customers sitting on the veranda bench (hips sit 0.84 m above the root)
    if (R() < .25) continue; const [x, z] = local({x: t.bx, z: t.bz, rot: t.yaw}, sx, 3.5); const [n_, w] = lineFor('sitter'), p = make(R.pick(['resident', 'worker', 'fisherman']), 'sitter', n_, w, false);
    put(p, x, z, t.yaw + Math.PI, t.y + .53 - .84); p.state = 'sit'; p.legs[0].rotation.x = p.legs[1].rotation.x = -1.45; p.arms[0].rotation.x = -.7; p.arms[1].rotation.x = -.35; fixed.push(p);
  }
  const used = new Set();
  for (let n = 0; n < 150 && fixed.filter(f => f.archetype === 'stander').length < 17; n++) {   // standing outside shops
    const d = R.pick(town.standSpots); if (used.has(d)) continue; const fx = Math.sin(d.yaw), fz = Math.cos(d.yaw), side = R.range(-2.2, 2.2), x = d.x + fx * R.range(1.8, 3.2) + fz * side, z = d.z + fz * R.range(1.8, 3.2) - fx * side;
    if (!spotOk(x, z, .35) || field.clearance(x, z) < .5) continue; used.add(d); const [n_, w] = lineFor('stander'), p = make(roleFor(), 'stander', n_, w); put(p, x, z, d.yaw + R.range(-.5, .5)); p.state = 'stand'; fixed.push(p);
  }
  for (const g of town.gardenSpots.filter(() => R() < .07)) {   // residents by their gates
    const c = Math.cos(g.rot), s = Math.sin(g.rot), lz = g.zf - R.range(1.2, 2.4), lx = R.range(-g.hw * .5, g.hw * .5), x = g.x + lx * c + lz * s, z = g.z - lx * s + lz * c;
    if (!spotOk(x, z, .35)) continue; const [n_, w] = lineFor('home'), p = make('resident', 'home', n_, w); put(p, x, z, g.rot + R.range(-.7, .7)); p.state = 'stand'; fixed.push(p);
  }
  for (const sp of extraSpots) {   // named roles at landmarks
    const [name, words] = LANDMARK_LINES[sp.role] || lineFor('stander'); let x = sp.x, z = sp.z;
    if (!spotOk(x, z, .35)) { let ok = false; for (let k = 0; k < 14 && !ok; k++) { x = sp.x + R.range(-4, 4); z = sp.z + R.range(-4, 4); ok = spotOk(x, z, .35); } if (!ok) continue; }
    const p = make(sp.role, 'landmark', name, words); put(p, x, z, sp.yaw ?? R() * 6.28); p.state = 'stand'; fixed.push(p);
  }

  /* ---- pooled walkers on pavements ---- */
  const urbanEdges = edgeData.filter(ed => ed.urban && ed.curbs && ed.e.width >= 4.6 && ed.e.len > 30), edgeById = new Map(urbanEdges.map(ed => [ed.e.id, ed]));
  const walkers = Array.from({length: walkerCount}, () => { const [n_, w] = lineFor('walker'), p = make(roleFor(), 'walker', n_, w); p.active = false; p.mesh.visible = false; p.mesh.position.set(0, -1000, 0); return p; });
  const swOf = ed => (ed.e.width >= 6.4 ? 2.3 : 1.6), walkOff = (ed, side) => side * (ed.e.width / 2 + swOf(ed) - .55);
  const walkerPos = (p, o) => { const pt = pointAt(p.ed.S, p.s), off = walkOff(p.ed, p.side); o.x = pt.x + pt.nx * off; o.z = pt.z + pt.nz * off; o.fx = pt.nz * p.dir; o.fz = -pt.nx * p.dir; return o; };
  function spawnWalker(p, pos) {
    for (let a = 0; a < 40; a++) {
      const ed = urbanEdges[(R() * urbanEdges.length) | 0], s = R() * ed.e.len, pt = pointAt(ed.S, s), d = Math.hypot(pt.x - pos.x, pt.z - pos.z); if (d < 35 || d > 230) continue;
      p.ed = ed; p.s = s; p.dir = R() < .5 ? 1 : -1; p.side = R() < .5 ? 1 : -1; p.speed = R.range(1.05, 1.55); p.active = true; p.pause = 0; p.mesh.visible = true;
      const q = walkerPos(p, {}); if (!spotOk(q.x, q.z, .3)) { p.active = false; continue; } put(p, q.x, q.z, faceYaw(q.fx, q.fz)); return true;
    } return false;
  }
  function stepWalker(p, dt) {
    if (p.pause > 0) { p.pause -= dt; p.animate(0, p.phase); return; }
    p.s += p.dir * p.speed * dt; const e = p.ed.e;
    if (p.s <= 0 || p.s >= e.len) {
      const nodeId = p.s <= 0 ? e.a : e.b, node = graph.nodes[nodeId], options = node.edges.map(r => edgeById.get(r.e)).filter(o => o && o !== p.ed);
      if (!options.length || nodeId === hub?.id) { p.dir = -p.dir; p.s = clamp(p.s, 0, e.len); } else { const o = R.pick(options); p.ed = o; p.dir = o.e.a === nodeId ? 1 : -1; p.s = p.dir > 0 ? .1 : o.e.len - .1; if (R() < .3) p.side = -p.side; }
    }
    const q = walkerPos(p, tmp), m = p.mesh.position, hx = q.x - m.x, hz = q.z - m.z, hl = Math.hypot(hx, hz);
    if (collision.circleHits(q.x, q.z, .28)) { p.dir = -p.dir; return; }   // never walk through a solid; turn around
    m.x = q.x; m.z = q.z; m.y = surfaceHeight(q.x, q.z); if (hl > .001) p.mesh.rotation.y += wrap(faceYaw(hx / hl, hz / hl) - p.mesh.rotation.y) * Math.min(1, dt * 6);
    p.phase += dt * p.speed * 2.6; p.animate(p.speed, p.phase); if (R() < dt * .06) p.pause = R.range(2.5, 7);
  }

  /* ---- pooled zebra-crossing pedestrians: wait for a gap, then cross ---- */
  const crossers = Array.from({length: crosserCount}, () => { const [n_, w] = lineFor('walker'), p = make(roleFor(), 'crosser', n_, w); p.active = false; p.mesh.visible = false; p.mesh.position.set(0, -1000, 0); return p; });
  const gapClear = c => { for (const v of trafficVehicles) { if (!v.ai.active) continue; if (Math.hypot(v.mesh.position.x - c.x, v.mesh.position.z - c.z) < 24 && v.ai.speed > .8) return false; } return true; };
  function spawnCrosser(p, pos) {
    for (let a = 0; a < 30; a++) {
      const c = crossings[(R() * crossings.length) | 0]; if (!c) return false; const d = Math.hypot(c.x - pos.x, c.z - pos.z); if (d < 28 || d > 170) continue;
      const dir = R() < .5 ? 1 : -1, half = c.width / 2 + 1.5; p.c = c; p.ax = c.tz * dir; p.az = -c.tx * dir; p.half = half; p.t = 0; p.active = true; p.state = 'wait'; p.wait = 0; p.speed = R.range(1.25, 1.6); p.mesh.visible = true;
      put(p, c.x - p.ax * half, c.z - p.az * half, faceYaw(p.ax, p.az)); if (!spotOk(p.mesh.position.x, p.mesh.position.z, .3)) { p.active = false; continue; } return true;
    } return false;
  }
  function stepCrosser(p, dt) {
    const c = p.c, m = p.mesh.position;
    if (p.state === 'wait') { p.wait += dt; p.animate(0, p.phase); if (gapClear(c) || p.wait > 14) p.state = 'cross'; return; }
    p.t += p.speed * dt; const k = p.t - p.half, x = c.x + p.ax * k, z = c.z + p.az * k; m.x = x; m.z = z; m.y = surfaceHeight(x, z); p.phase += dt * p.speed * 2.6; p.animate(p.speed, p.phase);
    if (p.t > p.half * 2) { p.active = false; p.mesh.visible = false; m.set(0, -1000, 0); }
  }

  let spawnT = 0;
  function update(dt, player, elapsed) {
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = .5; for (const p of walkers) if (!p.active) { spawnWalker(p, player); break; } else if (Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z) > 280) { p.active = false; p.mesh.visible = false; p.mesh.position.set(0, -1000, 0); }
      for (const p of crossers) if (!p.active) { spawnCrosser(p, player); break; } else if (Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z) > 240) { p.active = false; p.mesh.visible = false; p.mesh.position.set(0, -1000, 0); } }
    for (const p of walkers) if (p.active && Math.abs(p.mesh.position.x - player.x) < 320 && Math.abs(p.mesh.position.z - player.z) < 320) stepWalker(p, dt);
    for (const p of crossers) if (p.active) stepCrosser(p, dt);
    for (const p of fixed) {   // idle life: breathe, look around
      if (Math.abs(p.mesh.position.x - player.x) + Math.abs(p.mesh.position.z - player.z) > 260) continue;
      if (p.state === 'sit') { p.arms[0].rotation.x = -.7 + Math.sin(elapsed * .8 + p.phase) * .08; p.visual.rotation.z = Math.sin(elapsed * .3 + p.phase) * .02; continue; }
      p.animate(0, p.phase); p.visual.position.y = Math.sin(elapsed * 1.6 + p.phase) * .006; p.mesh.rotation.y += Math.sin(elapsed * .25 + p.phase) * dt * .12;
    }
  }
  return {npcs, update, fixed, walkers, crossers, stats: () => ({total: npcs.length, fixed: fixed.length, walkersActive: walkers.filter(p => p.active).length, crossersActive: crossers.filter(p => p.active).length})};
}
