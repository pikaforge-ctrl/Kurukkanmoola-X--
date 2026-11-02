import {mulberry32} from '../kit/util.js';
import {rgb, scaleRGB, mixRGB} from '../kit/batcher.js';
import {pointAt, urbanAt, coreAt} from './roads-core.js';
import {WALL_PALETTE} from '../kit/kit.js';

export const zoneAt = (x, z) => { const r = Math.hypot(x, z * 1.3); return r < 430 ? 'core' : r < 950 ? 'mid' : r < 1700 ? 'outer' : 'rural'; };

/**
 * Populates the world with buildings, compounds, signage and landmarks. Everything is registered with the CollisionWorld as
 * oriented boxes. ctx: {B, K, bk, graph, roads, roadside, collision, field, assets, W:{terrainHeight,isWater,waterInfo,nearestRoad,PLAYER_SPAWN,townKeepClear}}
 */
export function buildTown(ctx) {
  const {B, K, bk, roads, roadside, collision, field, W} = ctx;
  const R = mulberry32(90210), A = B.world('atlas'), AS = B.world('atlasS'), conc = K.r('concrete'), PW = B.world('poster');
  const placed = [], teaShops = [], gardenSpots = [], jobSites = [], parkedSpots = [], pedSpots = [], standSpots = [], hoardings = [];
  const th = W.terrainHeight, spawn = W.PLAYER_SPAWN, keep = W.townKeepClear, stats = {fail: {}, tried: {}, ok: {}};
  const bad = why => { stats.fail[why] = (stats.fail[why] || 0) + 1; return false; };
  const here = (ox, oz, rot, lx, lz) => [ox + lx * Math.cos(rot) + lz * Math.sin(rot), oz - lx * Math.sin(rot) + lz * Math.cos(rot)];

  /* ---- overhead service wires from the nearest pole to a building's front eave ---- */
  const poleGrid = new Map(); for (const p of roadside.poles) { const k = Math.floor(p.x / 30) + ':' + Math.floor(p.z / 30); (poleGrid.get(k) || poleGrid.set(k, []).get(k)).push(p); }
  const nearestPole = (x, z, r) => { let best = null, bd = r * r; const cx = Math.floor(x / 30), cz = Math.floor(z / 30); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const p of poleGrid.get((cx + dx) + ':' + (cz + dz)) || []) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } } return best; };
  function serviceDrop(rec) {
    if (!urbanAt(rec.x, rec.z) || R() > .65 || !['shopHouse', 'villa', 'traditionalHouse', 'hotel'].includes(rec.type)) return;
    const [fx, fz] = here(rec.x, rec.z, rec.rot, (R() < .5 ? -1 : 1) * rec.hw * .6, rec.zc + rec.hd - .3), pole = nearestPole(fx, fz, 24); if (!pole) return;
    const top = rec.y + Math.min(rec.info.h || 6, rec.type === 'shopHouse' ? rec.info.h : 7) - .5, L = Math.hypot(pole.x - fx, pole.z - fz);
    roadside.addWire([pole.x + pole.ax * .85, pole.y + 6.3, pole.z + pole.az * .85], [fx, top, fz], .25 + L * L * .0006);
  }

  /* ---- plans: dimensions known before building ---- */
  const PLAN = {
    shopHouse: (z, attempt = 0) => { const bays = attempt ? 2 : R.int(2, 5), floors = z === 'core' ? R.int(2, 4) : z === 'mid' ? R.int(1, 3) : R.int(1, 2), depth = attempt ? R.range(6.5, 8) : R.range(7.5, 11.5); return {hw: bays * 1.6, hd: depth / 2, zc: 0, opts: {bays, floors, depth, hoarding: floors >= 2 && R.chance(.18)}}; },
    villa: () => { const n = R.pick([3, 3, 4]), D = R.range(8.4, 10.5); return {hw: n * 1.6 + .8, hd: D / 2 + 2.5, zc: 0, opts: {bays: n, depth: D}}; },
    traditionalHouse: () => { const n = R.pick([3, 3, 5]), D = R.range(7, 8.6); return {hw: n * 1.6 + .6, hd: (D + 2.4) / 2 + .6, zc: 0, opts: {bays: n, depth: D}}; },
    hut: () => { const Wd = R.range(4.6, 6), D = R.range(3.8, 4.8); return {hw: Wd / 2 + .55, hd: D / 2 + .55, zc: 0, opts: {W: Wd, D}}; },
    teaShop: () => ({hw: 3.8, hd: 5.0, zc: 0, opts: {}}),
    hotel: () => { const bays = R.int(5, 7); return {hw: bays * 1.6, hd: 6.5, zc: 0, opts: {bays, depth: 13}}; },
    institution: n => { const bays = n ?? R.int(7, 11); return {hw: bays * 1.6 + .9, hd: 7.5, zc: 0, opts: {bays, depth: 13}}; },
    workshop: () => { const Wd = R.range(8, 11), D = R.range(7, 9); return {hw: Wd / 2 + 1.5, hd: D / 2 + .5, zc: 0, opts: {W: Wd, D}}; },
    supermarket: () => ({hw: 14.2, hd: 18, zc: 10, opts: {}}),
    petrol: () => ({hw: 12, hd: 12, zc: 6, opts: {}}),
    temple: small => ({hw: (small ? 9.5 : 15) + 1, hd: (small ? 8 : 13) + 1, zc: 0, opts: {small}}),
    church: () => ({hw: 5, hd: 12, zc: 0.7, opts: {}}),
    mosque: () => ({hw: 8, hd: 8, zc: 0, opts: {}}),
    stall: () => ({hw: 2.2, hd: 1.8, zc: 0, opts: {}}),
  };
  const HEIGHT = {shopHouse: 14, villa: 9, traditionalHouse: 8, hut: 4, teaShop: 5, hotel: 20, institution: 16, workshop: 6, supermarket: 8, petrol: 6, temple: 12, church: 20, mosque: 20, stall: 3};

  /* ---- bus & taxi stand builder (local +z faces the road) ---- */
  bk.busStand = (x, y, z, rot) => {
    const w = K.newWriter(x, y, z, rot), white = K.r('white');
    w.quadGrid([-22, .06, 14], [22, .06, 14], [22, .06, -14], [-22, .06, -14], 14, 9, conc, [.52, .54, .56]);
    for (let i = -4; i <= 4; i++) w.quad([i * 4.4 - .07, .08, -13], [i * 4.4 + .07, .08, -13], [i * 4.4 + .07, .08, -1], [i * 4.4 - .07, .08, -1], white, [.95, .94, .88]);
    for (let i = -2; i <= 2; i++) w.quad([-21, .08, 7 + i * 1.2 - .07], [-9, .08, 7 + i * 1.2 - .07], [-9, .08, 7 + i * 1.2 + .07], [-21, .08, 7 + i * 1.2 + .07], white, [.95, .94, .88]);
    for (const [lx, lz] of [[12, 10], [-6, 11]]) { const [wx, wz] = here(x, z, rot, lx, lz); bk.busShelter(wx, th(wx, wz) + .1, wz, rot, {variant: lx > 0 ? 0 : 2}); }
    return {hw: 22, hd: 14, h: 4, door: {x: 0, z: 15}, kind: 'busStand'};
  };

  /* ---- validity ---- */
  function validFootprint(cx, cz, hw, hd, rot, {margin = 1.0, roadMargin = null, ignore = null, slope = 2.8, water = 8} = {}) {
    if (Math.hypot(cx - spawn.x, cz - spawn.z) < 60 + Math.max(hw, hd)) return bad('spawn');
    if (Math.hypot(cx, cz) < 64 + Math.max(hw, hd) * .6) return bad('hub');
    const rm = roadMargin ?? (urbanAt(cx, cz) ? 2.5 : 1.3);
    const pts = [[0, 0], [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, hd], [0, -hd], [-hw, 0], [hw, 0], [-hw / 2, hd], [hw / 2, hd], [-hw / 2, -hd], [hw / 2, -hd]];
    let hMin = Infinity, hMax = -Infinity;
    for (const [lx, lz] of pts) { const [x, z] = here(cx, cz, rot, lx, lz); if (field.clearance(x, z) < rm) return bad('road'); const h = th(x, z); hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
    if (hw > 4 || hd > 4) { const nx = Math.min(24, Math.ceil(hw * 2 / 3)), nz = Math.min(24, Math.ceil(hd * 2 / 3));   // narrow lanes can slip between corner samples of large lots
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) { const [x, z] = here(cx, cz, rot, -hw + 2 * hw * i / nx, -hd + 2 * hd * j / nz); if (field.clearance(x, z) < rm) return bad('road'); } }
    if (hMax - hMin > slope) return bad('slope');
    for (const k of keep) if (!(ignore && ignore === k) && Math.hypot(cx - k.x, cz - k.z) < k.r * .8 + Math.max(hw, hd) * .5 && !(ignore === 'all')) return bad('keep');
    if (W.waterInfo(cx, cz).distance < water || W.waterInfo(...here(cx, cz, rot, hw, hd)).distance < 4 || W.waterInfo(...here(cx, cz, rot, -hw, -hd)).distance < 4) return bad('water');
    { const o = collision.overlapsBox(cx, cz, hw * 2, hd * 2, rot, margin); if (o) return bad('overlap:' + o.kind); }
    return true;
  }
  const faceRoad = (nx, nz) => Math.atan2(-nx, -nz);

  /** Build + register a building whose origin sits at (ox,oz). Returns the record or null. */
  function place(type, plan, ox, oz, rot, o = {}) {
    const [cx, cz] = here(ox, oz, rot, 0, plan.zc), zk = type + '@' + zoneAt(ox, oz); stats.tried[zk] = (stats.tried[zk] || 0) + 1;
    if (!validFootprint(cx, cz, plan.hw, plan.hd, rot, o.valid || {})) return null;
    stats.ok[zk] = (stats.ok[zk] || 0) + 1;
    const hs = [[0, 0], [-plan.hw, -plan.hd], [plan.hw, -plan.hd], [-plan.hw, plan.hd], [plan.hw, plan.hd]].map(([a, b]) => th(...here(ox, oz, rot, a, b)));
    const avg = hs.reduce((s, v) => s + v, 0) / hs.length, mn = Math.min(...hs), opts = {...plan.opts, ...o.opts, skirt: Math.min(3.5, avg - mn + .6)};
    const y = avg + .08, info = bk[type](ox, y, oz, rot, opts);
    collision.add({x: cx, z: cz, w: plan.hw * 2, d: plan.hd * 2, rot, baseY: y, height: info.h ?? HEIGHT[type] ?? 8, kind: 'building', ref: type});
    const rec = {type, x: ox, z: oz, cx, cz, rot, hw: plan.hw, hd: plan.hd, zc: plan.zc, y, info}; placed.push(rec);
    const [dx, dz] = here(ox, oz, rot, info.door.x, info.door.z); rec.door = {x: dx, z: dz}; serviceDrop(rec);
    if (type === 'teaShop') teaShops.push({id: teaShops.length, x: dx, z: dz, yaw: rot, bx: ox, bz: oz, name: opts.signName || 'Chaya Kada', y});
    if (['shopHouse', 'hotel', 'supermarket'].includes(type)) standSpots.push({x: dx, z: dz, yaw: rot});
    return rec;
  }
  /** Search outwards from (x,z) for a valid spot, facing the nearest road. */
  function placeNear(type, plan, x, z, {search = 120, step = 14, o = {}} = {}) {
    for (let r = 0; r <= search; r += step) for (let a = 0; a < (r ? 10 : 1); a++) {
      const ang = a / 10 * Math.PI * 2 + r * .37, px = x + Math.cos(ang) * r, pz = z + Math.sin(ang) * r, nr = W.nearestRoad(px, pz, true); if (!nr.road || nr.distance > 150) continue;
      const rd = nr.road, dx = rd.b[0] - rd.a[0], dz = rd.b[1] - rd.a[1], t = nr.t ?? 0, qx = rd.a[0] + dx * t, qz = rd.a[1] + dz * t; let nx = px - qx, nz = pz - qz; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const rec = place(type, plan, px, pz, faceRoad(nx, nz), o); if (rec) return rec;
    }
    return null;
  }

  /* ---- compound walls with weathered posters ---- */
  const wallStyles = [{tile: 'wallPanel', col: null, w: 5}, {tile: 'concrete', col: [.95, .95, .92], w: 3}, {tile: 'brick', col: [.9, .85, .8], w: 1.5}, {tile: 'laterite', col: [.82, .72, .66], w: 1.5}, {tile: 'wallPanel', col: null, w: 2}];
  const pickWallStyle = () => { let t = R() * wallStyles.reduce((s, v) => s + v.w, 0); for (const s of wallStyles) { t -= s.w; if (t <= 0) return s; } return wallStyles[0]; };
  const posterKeys = ctx.assets.posters.list.map(p => p.key), posterMeta = new Map(ctx.assets.posters.list.map(p => [p.key, p]));
  function poster(cx, cy, cz, nx, nz, w, h, key, rot, layer) {
    const r = ctx.assets.posters.rects[key]; if (!r) return;
    const ux = nz, uz = -nx, c = Math.cos(rot), s = Math.sin(rot), off = .018 + layer * .014, P = (a, b) => [cx + ux * (a * c - b * s) + nx * off, cy + (a * s + b * c), cz + uz * (a * c - b * s) + nz * off];
    PW.use('poster').quad(P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2), r, mixRGB([1, 1, 1], [.84, .82, .78], R()));
  }
  function posterWall(cx, cy, cz, nx, nz, len, height, density) {
    const count = R() < density ? R.int(1, 3) : 0; let layer = 0;
    for (let i = 0; i < count; i++) {
      const key = R.pick(posterKeys), m = posterMeta.get(key), strip = m.kind === 'strip', w = strip ? R.range(1.5, 2.1) : R.range(.7, .95), h = w * m.aspect, ux = nz, uz = -nx;
      if (h > height - .15 || w > len - .4) continue; const off = R.range(-len / 2 + w / 2 + .2, len / 2 - w / 2 - .2);
      poster(cx + ux * off, cy + (height - h) / 2 + R.range(-.08, .1), cz + uz * off, nx, nz, w, h, key, R.range(-.05, .05), layer++);
    }
  }
  function wallRun(x0, z0, x1, z1, {style, outerN = null, height = 1.5, tint, posters = 0, sideOnly = false}) {
    const len = Math.hypot(x1 - x0, z1 - z0); if (len < .8) return;
    const dx = (x1 - x0) / len, dz = (z1 - z0) / len, n = Math.max(1, Math.round(len / 3.2)), pl = len / n, tile = K.r(style.tile), col = style.col || tint;
    const nxOut = outerN ? outerN[0] : dz, nzOut = outerN ? outerN[1] : -dx; let runStart = null;
    const flush = i => { if (runStart === null) return; const a = runStart * pl, b = i * pl, mx = x0 + dx * (a + b) / 2, mz = z0 + dz * (a + b) / 2; collision.add({x: mx, z: mz, w: .32, d: b - a + .2, rot: Math.atan2(dx, dz), baseY: th(mx, mz), height: height + .1, kind: 'wall'}); runStart = null; };
    for (let i = 0; i < n; i++) {
      const ax = x0 + dx * pl * i, az = z0 + dz * pl * i, bx = ax + dx * pl, bz = az + dz * pl, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const ok = field.clearance(mx, mz) > .9 && field.clearance(ax, az) > .6 && field.clearance(bx, bz) > .6 && !W.isWater(mx, mz) && W.waterInfo(mx, mz).distance > 2 && !collision.circleHits(mx, mz, .4, -Infinity, Infinity, ['wall', 'pole']) && !collision.circleHits(ax, az, .25, -Infinity, Infinity, ['wall', 'pole']);
      if (!ok) { flush(i); continue; }
      if (runStart === null) runStart = i;
      const ya = th(ax, az), yb = th(bx, bz), A0 = [ax, ya - .2, az], B0 = [bx, yb - .2, bz], A1 = [ax, ya + height, az], B1 = [bx, yb + height, bz];
      const outerLeft = (nxOut * dz - nzOut * dx) < 0;   // quad(A0,B0,B1,A1) faces the run's LEFT normal; reversed order faces right
      const face = (flip, c) => { if (flip) AS.use('atlasS').quad(B0, A0, A1, B1, tile, c); else AS.use('atlasS').quad(A0, B0, B1, A1, tile, c); };
      face(!outerLeft, col); if (!sideOnly) face(outerLeft, scaleRGB(col, .9));
      const rx = dz * .17, rz = -dx * .17;   // coping slab, always faces up
      AS.use('atlasS').quad([ax - rx, ya + height + .05, az - rz], [bx - rx, yb + height + .05, bz - rz], [bx + rx, yb + height + .05, bz + rz], [ax + rx, ya + height + .05, az + rz], conc, [.92, .92, .9]);
      if (i % 2 === 0) { const g = AS.at(ax, ya - .2, az, Math.atan2(dx, dz)); g.box(0, (height + .45) / 2, 0, .42, height + .45, .42, conc, [.93, .92, .9], 'px nx pz nz'); }
      if (posters > 0) posterWall((ax + bx) / 2, ya + .08, (az + bz) / 2, nxOut, nzOut, pl - .5, height - .1, posters);
    }
    flush(n);
    if (!sideOnly) { const g = AS.at(x1, th(x1, z1) - .2, z1, Math.atan2(dx, dz)); g.box(0, (height + .45) / 2, 0, .42, height + .45, .42, conc, [.93, .92, .9], 'px nx pz nz'); }
  }
  function compound(rec, {front, side, back}) {
    const {x, z, rot, hw, hd, zc} = rec, style = pickWallStyle(), tint = rgb(R.pick(WALL_PALETTE)), P = (lx, lz) => here(x, z, rot, lx, lz);
    const zf = zc + hd + front, zb = zc - hd - back, lw = hw + side, gate = 1.7, fx = Math.sin(rot), fz = Math.cos(rot), rx = Math.cos(rot), rz = -Math.sin(rot), poster = coreAt(x, z) ? .55 : .38;
    wallRun(...P(-lw, zf), ...P(-gate, zf), {style, tint, posters: poster, outerN: [fx, fz]}); wallRun(...P(gate, zf), ...P(lw, zf), {style, tint, posters: poster, outerN: [fx, fz]});
    wallRun(...P(-lw, zb), ...P(-lw, zf), {style, tint, outerN: [-rx, -rz], sideOnly: true, posters: .12}); wallRun(...P(lw, zf), ...P(lw, zb), {style, tint, outerN: [rx, rz], sideOnly: true, posters: .12});
    wallRun(...P(lw, zb), ...P(-lw, zb), {style, tint, outerN: [-fx, -fz], sideOnly: true, posters: .08});
    for (const s of [-1, 1]) {   // gate pillars with lamps and swung-open iron gate leaves
      const [gx, gz] = P(s * (gate + .1), zf), gy = th(gx, gz), g = AS.at(gx, gy - .2, gz, rot);
      g.box(0, 1.2, 0, .5, 2.4, .5, conc, [.96, .95, .92], 'px nx pz nz py'); g.box(0, 2.45, 0, .64, .12, .64, conc, [.92, .92, .9], 'px nx pz nz py');
      g.use('sign').box(0, 2.72, 0, .28, .3, .28, K.S.glow, [1, .95, .8], 'px nx py pz nz'); g.use('atlasS');
      const leaf = K.r('gateBars'); g.quad([0, .2, 0], [0, .2, -1.5], [0, 1.8, -1.5], [0, 1.8, 0], leaf, [1, 1, 1]); g.quad([0, .2, -1.5], [0, .2, 0], [0, 1.8, 0], [0, 1.8, -1.5], leaf, [.8, .8, .8]);
    }
    const [p0x, p0z] = P(0, zf), [p1x, p1z] = P(0, zc + hd + .2), ya = th(p0x, p0z) + .05, pw = .9, ax = [rx * pw, rz * pw];   // paved path gate -> door
    AS.use('atlasS').quadGrid([p0x - ax[0], ya, p0z - ax[1]], [p0x + ax[0], ya, p0z + ax[1]], [p1x + ax[0], th(p1x, p1z) + .05, p1z + ax[1]], [p1x - ax[0], th(p1x, p1z) + .05, p1z - ax[1]], 1, Math.max(1, Math.round((zf - zc - hd) / 3)), K.r('stone'), [.86, .78, .7]);
    if (R() < .3) {   // washing line behind the house: two poles, a line and a few saris and shirts
      const lx0 = R.range(-lw + 1.8, lw - 4.6), lz = zb + R.range(1.2, 2.6), [ax2, az2] = P(lx0, lz), [bx2, bz2] = P(lx0 + 3.4, lz);
      if (field.clearance(ax2, az2) > .5 && !collision.circleHits(ax2, az2, .4) && !collision.circleHits(bx2, bz2, .4) && !collision.circleHits((ax2 + bx2) / 2, (az2 + bz2) / 2, .5)) {
        const g0 = AS.at(ax2, th(ax2, az2), az2, rot), g1 = AS.at(bx2, th(bx2, bz2), bz2, rot); for (const g of [g0, g1]) g.box(0, .95, 0, .07, 1.9, .07, K.r('woodDark'), [.8, .7, .6], 'px nx pz nz');
        g0.beam([0, 1.8, 0], [3.4, 1.8, 0], .015, K.r('metal'), [.3, .3, .3]);
        const cols = [[.9, .3, .35], [.95, .85, .3], [.3, .55, .85], [.95, .95, .92], [.3, .7, .45], [.85, .5, .8]];
        for (let c = 0; c < 5; c++) { const cx = .35 + c * .62, wd = R.range(.35, .55), hh = R.range(.5, .9), col = R.pick(cols); g0.quad([cx - wd / 2, 1.8 - hh, 0], [cx + wd / 2, 1.8 - hh, 0], [cx + wd / 2, 1.8, 0], [cx - wd / 2, 1.8, 0], K.r('white'), col); g0.quad([cx + wd / 2, 1.8 - hh, 0], [cx - wd / 2, 1.8 - hh, 0], [cx - wd / 2, 1.8, 0], [cx + wd / 2, 1.8, 0], K.r('white'), scaleRGB(col, .85)); }
      }
    }
    gardenSpots.push({x, z, rot, hw: lw, zf, zb, zc, hd, gate});
  }

  /* ---- job counters / depots ---- */
  function jobCounter(x, z, rot, role, signId, pay) {
    const y = th(x, z), g = A.at(x, y, z, rot);
    g.box(0, .5, 0, 3.4, 1, 1.1, K.r('woodDark'), [.9, .85, .8], 'px nx pz nz'); g.box(0, 1.02, 0, 3.6, .08, 1.3, K.r('stone'), [.85, .85, .83], 'px nx py pz nz');
    for (const px of [-1.5, 1.5]) g.box(px, 1.3, .55, .1, 2.6, .1, K.r('metal'), [.35, .36, .38], 'px nx pz nz');
    K.awning(g, -1.9, 1.9, 2.6, -.4, 1.7, R.pick(['awnRW', 'awnGW', 'awnBW', 'awnOY']), .5); K.sign(g, signId, 0, 2.05, .62, 3.0, .75);
    collision.add({x, z, w: 3.6, d: 1.4, rot, baseY: y, height: 1.2, kind: 'prop'}); jobSites.push({role, x, z, pay, kind: 'counter'});
  }
  function jobDepot(x, z, rot, role, signId, pay, vehicleKinds) {
    const y = th(x, z), g = A.at(x, y, z, rot);
    g.box(0, 1.5, 0, .22, 3.0, .22, K.r('metal'), [.3, .31, .33], 'px nx pz nz'); K.sign(g, signId, 0, 2.7, .16, 1.9, .5); K.sign(g, signId, 0, 2.7, -.16, 1.9, .5, {nz: -1});
    jobSites.push({role, x, z, pay, kind: 'vehicle', vehicleKinds});
  }

  /* ---- 1. named landmarks ---- */
  const landmarkRecs = {};
  landmarkRecs.college = placeNear('institution', {...PLAN.institution(16), hd: 12.5}, 850, -145, {search: 90, o: {opts: {sign: 'nss', bays: 16, depth: 24, floors: 4}, valid: {ignore: 'all'}}}) || placeNear('institution', PLAN.institution(8), 850, -145, {search: 200, o: {opts: {sign: 'nss', floors: 4}, valid: {ignore: 'all'}}});
  landmarkRecs.science = placeNear('institution', PLAN.institution(8), 950, -130, {search: 120, o: {opts: {sign: 'college', floors: 3}, valid: {ignore: 'all'}}});
  landmarkRecs.hotel = placeNear('hotel', PLAN.hotel(), 440, -120, {search: 100, o: {opts: {sign: 'aryaas', floors: 5, bays: 7}, valid: {ignore: 'all'}}});
  landmarkRecs.padma = placeNear('shopHouse', {hw: 6.4, hd: 5, zc: 0, opts: {bays: 4, floors: 3, depth: 10, kind: 'restaurant', sign: 'padma'}}, 540, 220, {search: 90});
  landmarkRecs.calicut = placeNear('shopHouse', {hw: 4.8, hd: 5, zc: 0, opts: {bays: 3, floors: 2, depth: 10, kind: 'restaurant', sign: 'calicut'}}, 780, 310, {search: 90});
  landmarkRecs.arabian = placeNear('shopHouse', {hw: 4.8, hd: 5, zc: 0, opts: {bays: 3, floors: 3, depth: 10, kind: 'restaurant', sign: 'arabian'}}, -260, 180, {search: 140});
  const sm = placeNear('supermarket', PLAN.supermarket(), 600, -150, {search: 160, o: {opts: {sign: 'kuru'}}});
  if (sm) { const [cx, cz] = here(sm.x, sm.z, sm.rot, 7.4, 6.8); jobCounter(cx, cz, sm.rot, 'Supermarket Cashier', 'jc_super', 45); }
  const shopJob = (name, x, z, kind, sign, role, jc, pay) => {
    const rec = placeNear('shopHouse', {hw: 4.8, hd: 5, zc: 0, opts: {bays: 3, floors: 2, depth: 10, kind, sign}}, x, z, {search: 160});
    if (rec) { const [cx, cz] = here(rec.x, rec.z, rec.rot, 0, rec.hd + 2.4); jobCounter(cx, cz, rec.rot, role, jc, pay); } else console.warn('job shop not placed', name);
    return rec;
  };
  shopJob('meat', 660, -95, 'meat', 'meatstall', 'Meat Cutter', 'jc_meat', 55); shopJob('fish', 560, 265, 'fish', 'kadal', 'Fish Seller', 'jc_fish', 50); shopJob('store', 300, -190, 'grocery', 'kuttettan', 'Shop Owner', 'jc_store', 40);
  for (const [x, z, small] of [[650, -815, false], [-850, -745, false], [-1050, 580, false], [-3250, 2200, true], [1900, 700, true], [-1850, -2050, true]]) placeNear('temple', PLAN.temple(small), x, z, {search: 200, step: 22, o: {valid: {ignore: 'all'}}});
  const religious = [];
  const placeRel = (type, count, rMin, rMax, plan) => { for (let n = 0, done = 0; n < 60 && done < count; n++) { const a = R() * Math.PI * 2, r = R.range(rMin, rMax), x = Math.cos(a) * r * 1.15, z = Math.sin(a) * r * .9; if (religious.some(p => Math.hypot(p.x - x, p.z - z) < 220)) continue; const rec = placeNear(type, plan(), x, z, {search: 90}); if (rec) { done++; religious.push(rec); } } };
  placeRel('church', 3, 380, 1000, PLAN.church); placeRel('mosque', 2, 380, 1000, PLAN.mosque); placeRel('temple', 3, 500, 1100, () => PLAN.temple(true));
  placeNear('petrol', PLAN.petrol(), 330, 60, {search: 220, step: 20, o: {valid: {roadMargin: 3}}}); placeNear('petrol', PLAN.petrol(), -300, 420, {search: 260, step: 20, o: {valid: {roadMargin: 3}}});

  /* ---- 2. bus & taxi stand next to the roundabout ---- */
  const bus = placeNear('busStand', {hw: 22, hd: 14, zc: 0, opts: {}}, 150, 62, {search: 200, step: 16, o: {valid: {roadMargin: 1.5, slope: 1.8}}}) || null;
  if (bus) {
    const P = (lx, lz) => here(bus.x, bus.z, bus.rot, lx, lz);
    jobDepot(...P(-19, 13), bus.rot, 'Taxi Driver', 'jc_taxi', 90, ['taxi']); jobDepot(...P(17, 13), bus.rot, 'Bus Driver', 'jc_bus', 70, ['bus', 'swift', 'private']);
    for (let i = 0; i < 4; i++) { const [x, z] = P(-19 + i * 2.7, 8); parkedSpots.push({kind: 'taxi', x, z, yaw: bus.rot}); }
    for (let i = 0; i < 3; i++) { const [x, z] = P(-4.4 + i * 4.4, -7); parkedSpots.push({kind: ['bus', 'swift', 'private'][i], x, z, yaw: bus.rot}); }
  } else { jobDepot(76, -27, 0, 'Taxi Driver', 'jc_taxi', 90, ['taxi']); jobDepot(140, -27, 0, 'Bus Driver', 'jc_bus', 70, ['bus', 'swift', 'private']); }

  /* ---- 3. frontage lots along every urban road ---- */
  const choose = (zone, w) => {
    const r = R(), main = w >= 6.4, street = w >= 4.7;
    if (zone === 'core') return street ? (r < .04 ? 'hotel' : r < .82 ? 'shopHouse' : r < .9 ? 'villa' : null) : (r < .3 ? 'villa' : r < .48 ? 'traditionalHouse' : r < .78 ? 'shopHouse' : null);
    if (zone === 'mid') return main ? (r < .5 ? 'shopHouse' : r < .7 ? 'villa' : r < .85 ? 'traditionalHouse' : null) : street ? (r < .24 ? 'shopHouse' : r < .55 ? 'villa' : r < .8 ? 'traditionalHouse' : r < .84 ? 'hut' : null) : (r < .36 ? 'villa' : r < .66 ? 'traditionalHouse' : r < .74 ? 'hut' : null);
    if (zone === 'outer') return r < .38 ? 'villa' : r < .74 ? 'traditionalHouse' : r < .84 ? 'hut' : w >= 6.4 && r < .93 ? 'shopHouse' : null;
    return r < .32 ? 'villa' : r < .62 ? 'traditionalHouse' : r < .82 ? 'hut' : null;
  };
  const fill = {core: .9, mid: .4, outer: .2, rural: .055};
  const sortedEdges = roads.edgeData.filter(ed => !['forest', 'trail', 'hill'].includes(ed.e.type) && ed.e.len > 24).sort((a, b) => Math.hypot(a.S[0].x, a.S[0].z) - Math.hypot(b.S[0].x, b.S[0].z));
  for (const ed of sortedEdges) {
    const {e, S} = ed, w = e.width, sw = ed.curbs ? (w >= 6.4 ? 2.3 : 1.6) : 1.0;
    for (const side of [1, -1]) {
      let s = ed.padA + R.range(3, 7); const end = e.len - ed.padB - 3; let prev = null;
      while (s < end) {
        const p0 = pointAt(S, s), zone = zoneAt(p0.x, p0.z);
        if (R() > fill[zone]) { s += R.range(9, 22); prev = null; continue; }
        const kind = choose(zone, w); if (!kind) { s += R.range(8, 18); prev = null; continue; }
        let tryKind = kind, rec = null;
        for (let attempt = 0; attempt < 3 && !rec; attempt++) {
          const plan = PLAN[tryKind](zone, attempt), house = ['villa', 'traditionalHouse', 'hut'].includes(tryKind), row = tryKind === 'shopHouse' && zone === 'core' && prev && prev.type === 'shopHouse' && R() < .8;
          const setback = house ? (zone === 'core' ? R.range(5, 8) : zone === 'mid' ? R.range(6, 11) : R.range(7, 14)) : tryKind === 'shopHouse' ? (zone === 'core' ? Math.max(.5, 2.7 - sw) : R.range(1.2, 3.5)) : R.range(3, 7);
          const gapBefore = row ? 0 : (house ? R.range(3, 8) : tryKind === 'shopHouse' && zone === 'core' ? R.range(.8, 4) : R.range(4, 10)), sc = s + gapBefore + plan.hw; if (sc > end) break;
          const pc = pointAt(S, sc), nx = pc.nx * side, nz = pc.nz * side, dist = w / 2 + sw + setback + plan.zc + plan.hd, ox = pc.x + nx * dist, oz = pc.z + nz * dist, rot = faceRoad(nx, nz) + (row ? 0 : R.range(-.03, .03));
          const opts = {}; if (tryKind === 'shopHouse') { opts.exposedL = !row; opts.exposedR = !(zone === 'core' && R() < .7); }
          rec = place(tryKind, plan, ox, oz, rot, {opts, valid: row ? {margin: -.4} : {}});
          if (rec) {
            if (house && setback > 4.5 && tryKind !== 'hut' && R() < .62) compound(rec, {front: Math.max(2, setback - .5), side: R.range(1.8, 3.8), back: R.range(3, 6)});
            if (tryKind === 'shopHouse' && zone !== 'outer' && R() < .6) for (let k = R.int(1, 3); k > 0; k--) {   // motorcycles and scooters parked on the pavement in front of shops
              const lx = R.range(-plan.hw + 1, plan.hw - 1), lz = plan.hd + R.range(1.1, 1.9), [bx, bz] = here(ox, oz, rot, lx, lz), br = rot + Math.PI / 2 + R.range(-.5, .5);
              if (field.clearance(bx, bz) < .9 || collision.circleHits(bx, bz, .55) || W.isWater(bx, bz)) continue;
              bk.bike(bx, th(bx, bz) + .02, bz, br, {}); collision.add({x: bx, z: bz, w: .6, d: 1.6, rot: br, baseY: th(bx, bz), height: 1, kind: 'prop'});
            }
            prev = rec; s = sc + plan.hw + (tryKind === 'shopHouse' ? 0 : .5);
            if (tryKind === 'shopHouse' && R() < .12) {   // roadside stall beside shops
              const sp = pointAt(S, Math.min(end, s + 3)), sx = sp.x + sp.nx * side * (w / 2 + sw - .6), sz = sp.z + sp.nz * side * (w / 2 + sw - .6), sr = faceRoad(sp.nx * side, sp.nz * side);
              if (zone !== 'rural' && sw > 1.5 && validFootprint(sx, sz, 2.2, 1.6, sr, {roadMargin: 0, margin: .5})) { bk.stall(sx, th(sx, sz) + .38, sz, sr, {}); collision.add({x: sx, z: sz, w: 3.8, d: 3, rot: sr, baseY: th(sx, sz), height: 2.4, kind: 'prop'}); }
            }
          } else if (zone === 'core') { if (attempt >= 1) break; tryKind = 'shopHouse'; } else tryKind = house ? 'hut' : 'villa';
        }
        if (!rec) { s += R.range(6, 12); prev = null; }
      }
    }
  }

  /* ---- 4. tea shops: next to bus stops and on busy streets ---- */
  const teaPlan = PLAN.teaShop();
  for (const bs of roadside.busStops.slice(0, 5)) placeNear('teaShop', teaPlan, bs.x + (R() - .5) * 26, bs.z + (R() - .5) * 26, {search: 36, step: 9, o: {opts: {signName: 'Chaya Kada'}}});
  for (let n = 0; n < 40 && teaShops.length < 9; n++) { const ed = R.pick(sortedEdges.filter(e => zoneAt(e.S[0].x, e.S[0].z) !== 'rural' && e.e.width >= 4.6)); if (!ed) break; const p = pointAt(ed.S, ed.e.len * R.range(.2, .8)); placeNear('teaShop', teaPlan, p.x + p.nx * 14, p.z + p.nz * 14, {search: 30, step: 10}); }

  /* ---- 5. billboards beside main roads ---- */
  for (const ed of roads.edgeData) {
    const {e, S} = ed; if (e.width < 6.4 || e.len < 120 || ['hill', 'forest', 'trail'].includes(e.type) || R() > .22) continue;
    const side = R() < .5 ? 1 : -1, s = e.len * R.range(.3, .7), p = pointAt(S, s), off = side * (e.width / 2 + (ed.curbs ? 5.5 : 4.5)), x = p.x + p.nx * off, z = p.z + p.nz * off, yaw = Math.atan2(p.nz, -p.nx);
    if (!validFootprint(x, z, 5, 1, yaw, {roadMargin: 1.5, margin: .8, slope: 4})) continue;
    const y = th(x, z), g = B.world('atlas').at(x, y, z, yaw);
    g.box(0, 3, 0, .45, 6, .45, K.r('metal'), [.4, .42, .45], 'px nx pz nz'); K.hoarding(g, 0, 5, 0, 10, 4.5, {}); g.box(0, 5.2, .5, 9.6, .08, .5, K.r('metal'), [.4, .4, .42], 'py');
    collision.add({x, z, w: 1, d: 1, baseY: y, height: 6, kind: 'prop'}); hoardings.push({x, z, yaw});
  }
  return {stats, placed, teaShops, gardenSpots, jobSites, parkedSpots, pedSpots, standSpots, hoardings, landmarkRecs, bus, PLAN, place, placeNear, compound, jobCounter, validFootprint};
}
