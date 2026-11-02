import {rgb, scaleRGB, mixRGB} from './batcher.js';
import {FH, BAY} from './kit.js';

// Building archetypes. Local frame: origin at footprint centre on the ground, front (door/street side) is +z.
// Each builder writes straight into the Batcher and returns {hw, hd, h, door:{x,z}, kind} in local coordinates.
const SHOPS = {
  grocery: {tile: 'goodsA', signs: ['stores', 'mart']}, veg: {tile: 'goodsB', signs: ['veg']}, fish: {tile: 'goodsC', signs: ['fish']}, meat: {tile: 'goodsD', signs: ['meat']},
  super: {tile: 'glassSuper', signs: ['super', 'mart']}, restaurant: {tile: 'glassFood', signs: ['restaurant', 'hotel', 'grill', 'cafe']}, textile: {tile: 'glassTextile', signs: ['textile']},
  mobile: {tile: 'glassMobile', signs: ['mobile']}, pharmacy: {tile: 'glassPharmacy', signs: ['medical', 'clinic']}, hardware: {tile: 'glassHardware', signs: ['hardware', 'workshop']},
  bakery: {tile: 'shopBakery', signs: ['bakery', 'juice']}, tea: {tile: 'shopTea', signs: ['tea1', 'tea2', 'tea3']}, closed: {tile: 'shopRoll', signs: ['travels', 'tuition', 'xerox', 'optical', 'bank']}, jewel: {tile: 'glassTextile', signs: ['jewel']},
};
export const SHOP_KINDS = Object.keys(SHOPS);
const AWN = ['awnRW', 'awnGW', 'awnBW', 'awnOY'];
const lighten = (c, t) => mixRGB(c, [1, 1, 1], t);

export function createBuildings(K) {
  const R = K.rnd, B = {};

  /* ---------------------------------------------------------------- shop house */
  B.shopHouse = (x, y, z, rot, o = {}) => {
    const bays = o.bays ?? R.int(2, 5), floors = o.floors ?? R.int(1, 3), W = bays * BAY, D = o.depth ?? R.range(8, 12), fp = {hw: W / 2, hd: D / 2};
    const w = K.newWriter(x, y, z, rot), wall = o.wall ? rgb(o.wall) : K.wallColor(), shopTint = lighten(wall, .6);
    K.skirt(w, fp, o.skirt ?? .9);
    const units = []; for (let i = 0; i < bays;) { const n = Math.min(bays - i, R.int(1, Math.min(3, bays))), kind = o.kind && units.length === 0 ? o.kind : R.pick(SHOP_KINDS); units.push({i, n, kind}); i += n; }
    const unitAt = i => units.find(u => i >= u.i && i < u.i + u.n), style = R.pick(['A', 'B', 'C']);
    K.facade(w, fp, 'front', {floors, tile: (f, i, n) => {
      if (f === 0) return SHOPS[unitAt(i).kind].tile;
      if (f === 1 && floors >= 2 && style === 'C' && i === Math.floor(n / 2)) return K.win('winD');
      return K.win(style === 'A' ? (i % 2 ? 'winB' : 'winA') : style === 'B' ? 'winB' : (i % 2 ? 'winC' : 'winA'));
    }, col: f => (f === 0 ? shopTint : wall)});
    for (const [s, exposed] of [['right', o.exposedR !== false], ['left', o.exposedL !== false]]) if (exposed)
      K.facade(w, fp, s, {floors, tile: (f, i) => (f === 0 ? (i % 2 ? K.win('winC') : 'wallDirt') : (R.chance(.18) ? 'blankAC' : K.win(i % 2 ? 'winA' : 'winF'))), col: () => wall, bayW: 3.6});
    K.facade(w, fp, 'back', {floors, tile: (f, i) => (f === 0 ? 'wallDirt' : R.pick(['wall', 'winF', 'blankAC', 'winA'])), col: () => wall});
    for (let f = 1; f <= floors; f++) K.band(w, fp, f * FH - .14, .28, .09, 'cornice', lighten(wall, .5), 'front' + (o.exposedR !== false ? ' right' : '') + (o.exposedL !== false ? ' left' : ''));
    const top = floors * FH, tiled = o.roof === 'tile' || (o.roof !== 'flat' && floors === 1 && R.chance(.7));
    if (tiled) K.gable(w, fp.hw, fp.hd, top, R.range(1.5, 2.1), .65, K.roofTint(), {gableTile: 'wall', gableCol: wall, ovEnd: o.exposedR === false && o.exposedL === false ? 0 : .5});
    else {
      K.flatRoof(w, fp, top, {col: wall});
      if (R.chance(.85)) K.tank(w, R.range(-W / 3, W / 3), top + .18, -D / 4 + R.range(-1, 1));
      if (R.chance(.4)) K.tank(w, R.range(-W / 3, W / 3), top + .18, -D / 4 + R.range(-1, 1));
      if (R.chance(.6)) w.box(-W / 2 + 1.4, top + 1.3, -D / 2 + 1.4, 2.2, 2.2, 2.2, K.r('wall'), lighten(wall, .2), 'px nx pz nz py');
    }
    for (const u of units) {
      const x0 = -fp.hw + u.i * BAY + .15, x1 = x0 + u.n * BAY - .3, def = SHOPS[u.kind];
      if (o.awning !== false && R.chance(.65) && u.kind !== 'closed') K.awning(w, x0, x1, 2.55, fp.hd, 1.25, R.pick(AWN));
      K.sign(w, o.sign && u === units[0] ? o.sign : R.pick(def.signs), (x0 + x1) / 2, 3.2, fp.hd + .06, Math.min(u.n * BAY - .5, 6.4), Math.min(1.6, (u.n * BAY - .5) / 4 + .2));
    }
    if (floors >= 2 && style === 'C') K.balcony(w, 0, FH, fp.hd, 3, 1.1);
    for (let f = 1; f < floors; f++) if (R.chance(.7)) K.ac(w, R.pick([-1, 1]) * R.range(.6, W / 2 - .9), f * FH + 2.1, fp.hd);
    if (o.hoarding && !tiled) K.hoarding(w, 0, top + 1.0, fp.hd - .6, Math.min(W - 1, 8), 3);
    return {hw: fp.hw, hd: fp.hd, h: top + (tiled ? 2 : 1), door: {x: 0, z: fp.hd}, kind: 'shop', units, tiled};
  };

  /* ---------------------------------------------------------------- traditional tiled house (reference image 2) */
  B.traditionalHouse = (x, y, z, rot, o = {}) => {
    const n = o.bays ?? R.pick([3, 3, 5]), W = n * BAY, D = o.depth ?? R.range(7, 8.6), Dv = 2.4, zb = -Dv / 2, hdT = (D + Dv) / 2 + .6;
    const w = K.newWriter(x, y, z, rot), wall = o.wall ? rgb(o.wall) : rgb(R.pick(['#f6f1e6', '#f3ead6', '#efe3c4']));
    const fpMain = {hw: W / 2, hd: D / 2}, wm = w.child(0, 0, zb), py = .9, wh = 3, tint = K.roofTint();
    K.skirt(w, {hw: W / 2 + .5, hd: hdT - .6}, 1.2);
    K.boxT(w, 0, py / 2, 0, W + 1.2, py, D + Dv + 1.2, 'plinth', [.9, .92, .95], 'px nx pz nz');
    w.box(0, py - .01, 0, W + 1.2, .04, D + Dv + 1.2, K.r('stone'), [.75, .76, .74], 'py');
    for (let s = 0; s < 3; s++) w.box(0, .14 + s * .14, D / 2 + Dv / 2 + .6 + (2 - s) * .33 + .2, 3.6, .28, .6, K.r('plinth'), [.85, .88, .92], 'px nx py pz');
    const mid = Math.floor(n / 2);
    K.facade(wm, fpMain, 'front', {y0: py, floors: 1, fh: wh, tile: (f, i) => (i === mid ? 'doorA' : K.win(i % 2 ? 'winC' : 'winA')), col: () => wall});
    for (const s of ['right', 'left']) K.facade(wm, fpMain, s, {y0: py, floors: 1, fh: wh, tile: (f, i) => (i % 2 ? K.win('winA') : 'wall'), col: () => wall, bayW: 3.4});
    K.facade(wm, fpMain, 'back', {y0: py, floors: 1, fh: wh, tile: (f, i) => (i % 2 ? 'winF' : 'wall'), col: () => wall});
    const zv = D / 2 + zb + Dv - .35;
    for (let i = 0; i <= n; i++) K.column(w, -W / 2 + .45 + (W - .9) * i / n, py, zv, 2.5, .3);
    for (const sx of [-1, 1]) { w.box(sx * W / 4, py + .5, zv - 1.4, 2.4, .08, .5, K.r('woodDark'), [1, 1, 1], 'py px nx pz nz'); for (const o2 of [-1, 1]) w.box(sx * W / 4 + o2 * 1.05, py + .25, zv - 1.4, .08, .5, .45, K.r('woodDark'), [1, 1, 1], 'px nx pz'); }
    const zf = D / 2 + zb, yWall = py + wh;
    K.shed(w, -W / 2 - .6, W / 2 + .6, zf - .2, zf + Dv + .55, yWall + .05, yWall - .75, tint);
    w.beam([-W / 2 - .6, yWall - .75, zf + Dv + .55], [W / 2 + .6, yWall - .75, zf + Dv + .55], .16, K.r('woodDark'), [.7, .45, .35]);
    const ry = K.gable(wm, W / 2, D / 2, yWall + .35, (D / 2 + .7) * .62, .7, tint, {gableTile: 'wall', gableCol: wall, ovEnd: .75});
    const gx = 1.9, gy = yWall + .5, gz0 = zf - 1.1, gz1 = zf + Dv + .15, rise = 1.7;   // front gable porch with a carved jali panel
    K.roofQuad(w, [-gx - .3, gy, gz1], [0, gy + rise, gz1], [0, gy + rise, gz0], [-gx - .3, gy, gz0], tint);
    K.roofQuad(w, [0, gy + rise, gz1], [gx + .3, gy, gz1], [gx + .3, gy, gz0], [0, gy + rise, gz0], scaleRGB(tint, .94));
    const jt = K.r('gableJali');
    w.tri([-gx, gy, gz1 - .05], [gx, gy, gz1 - .05], [0, gy + rise - .06, gz1 - .05], [jt[0], jt[1]], [jt[2], jt[1]], [(jt[0] + jt[2]) / 2, jt[3]], [1, 1, 1]);
    w.beam([-gx - .3, gy, gz1], [0, gy + rise + .02, gz1], .12, K.r('woodDark'), [.7, .45, .35]); w.beam([gx + .3, gy, gz1], [0, gy + rise + .02, gz1], .12, K.r('woodDark'), [.7, .45, .35]);
    w.cyl(0, gy + rise, gz1 - .02, .07, .02, .5, 6, K.r('gold'), [1, 1, 1]);
    return {hw: W / 2 + .6, hd: hdT, h: ry, door: {x: 0, z: D / 2 + zb + Dv + .5}, kind: 'house'};
  };

  /* ---------------------------------------------------------------- modern two-storey villa with hip roof */
  B.villa = (x, y, z, rot, o = {}) => {
    const n = o.bays ?? R.pick([3, 3, 4]), W = n * BAY, D = o.depth ?? R.range(8.4, 10.5), fh = 3.1, fp = {hw: W / 2, hd: D / 2}, floors = o.floors ?? 2;
    const w = K.newWriter(x, y, z, rot), wall = o.wall ? rgb(o.wall) : K.wallColor(), tint = K.roofTint();
    K.skirt(w, fp, o.skirt ?? 1); K.boxT(w, 0, .25, 0, W + .2, .5, D + .2, 'plinth', [.85, .87, .9], 'px nx pz nz');
    const py = .5, mid = Math.floor(n / 2);
    K.facade(w, fp, 'front', {y0: py, floors, fh, tile: (f, i) => (f === 0 ? (i === mid ? 'doorA' : K.win(i % 2 ? 'winB' : 'winA')) : (i === mid ? K.win('winD') : K.win(i % 2 ? 'winC' : 'winA'))), col: () => wall});
    for (const s of ['right', 'left']) K.facade(w, fp, s, {y0: py, floors, fh, tile: (f, i) => (i % 2 ? K.win('winA') : (R.chance(.25) ? 'blankAC' : 'wall')), col: () => wall, bayW: 3.6});
    K.facade(w, fp, 'back', {y0: py, floors, fh, tile: () => R.pick(['wall', 'winF', 'winA']), col: () => wall});
    K.band(w, fp, py + fh - .14, .28, .1, 'cornice', lighten(wall, .5));
    const pw = 3.4, pd = 2.5;
    w.box(0, py + .06, D / 2 + pd / 2, pw, .12, pd, K.r('stone'), [.8, .8, .78], 'px nx py pz');
    for (const sx of [-1, 1]) K.column(w, sx * (pw / 2 - .25), py, D / 2 + pd - .3, fh - .1, .3, 'concrete', [1, 1, 1]);
    K.balcony(w, 0, py + fh, D / 2, pw + .4, pd, {col: [1, 1, 1]});
    const eave = py + floors * fh, ry = K.hip(w, W / 2, D / 2, eave, R.range(.5, .68), .8, tint);
    if (R.chance(.7)) K.tank(w, R.range(-W / 4, W / 4), ry - 1.1, -D / 4, .5, 1.0);
    if (R.chance(.5)) K.ac(w, R.pick([-1, 1]) * (W / 2 - 1.3), py + fh + 2, D / 2);
    return {hw: W / 2 + .8, hd: D / 2 + pd, h: ry, door: {x: 0, z: D / 2 + pd + .4}, kind: 'house'};
  };

  /* ---------------------------------------------------------------- institution / college / school / hospital */
  B.institution = (x, y, z, rot, o = {}) => {
    const bays = o.bays ?? R.int(7, 11), floors = o.floors ?? R.int(3, 4), W = bays * BAY, D = o.depth ?? 13, fp = {hw: W / 2, hd: D / 2};
    const w = K.newWriter(x, y, z, rot), wall = rgb(o.wall ?? R.pick(['#e8d2a0', '#efe3c4', '#e9c9a0', '#d9e2cc'])), tint = K.roofTint();
    K.skirt(w, fp, 1); K.boxT(w, 0, .3, 0, W + .2, .6, D + .2, 'plinth', [.85, .87, .9], 'px nx pz nz');
    const py = .6, mid = Math.floor(bays / 2), ent = i => Math.abs(i - mid) <= 1;
    K.facade(w, fp, 'front', {y0: py, floors, tile: (f, i) => (f === 0 ? (i === mid ? 'doorA' : ent(i) ? 'arcade' : K.win('winB')) : (ent(i) && f === 1 ? K.win('winD') : K.win(f % 2 ? 'winB' : 'winE'))), col: () => wall});
    for (const s of ['right', 'left']) K.facade(w, fp, s, {y0: py, floors, tile: (f, i) => K.win(i % 2 ? 'winB' : 'winA'), col: () => wall, bayW: 3.6});
    K.facade(w, fp, 'back', {y0: py, floors, tile: () => K.win('winB'), col: () => wall});
    for (let f = 1; f <= floors; f++) K.band(w, fp, py + f * FH - .14, .28, .1, 'cornice', lighten(wall, .5));
    K.balcony(w, 0, py + FH, fp.hd, 3 * BAY - .4, 1.0);
    K.sign(w, o.sign ?? 'college', 0, py + FH - .35, fp.hd + .12, Math.min(11, W * .55), 1.5);
    const ry = K.hip(w, W / 2, D / 2, py + floors * FH, .32, .9, tint);
    return {hw: W / 2 + .9, hd: D / 2 + 1, h: ry, door: {x: 0, z: fp.hd + .6}, kind: 'institution'};
  };

  /* ---------------------------------------------------------------- hotel */
  B.hotel = (x, y, z, rot, o = {}) => {
    const bays = o.bays ?? R.int(5, 7), floors = o.floors ?? R.int(4, 5), W = bays * BAY, D = o.depth ?? 13, fp = {hw: W / 2, hd: D / 2};
    const w = K.newWriter(x, y, z, rot), wall = rgb(o.wall ?? R.pick(['#f1e6cf', '#ece9e2', '#e9d8b0'])), top = floors * FH;
    K.skirt(w, fp, .9);
    K.facade(w, fp, 'front', {floors, tile: (f, i, n) => (f === 0 ? (i === Math.floor(n / 2) ? 'arcade' : 'glassFood') : (f === floors - 1 || (i % 2) ? K.win('winE') : 'glassDark')), col: f => (f === 0 ? [1, 1, 1] : wall)});
    for (const s of ['right', 'left']) K.facade(w, fp, s, {floors, tile: (f, i) => (f === 0 ? 'wallDirt' : K.win('winA')), col: () => wall, bayW: 3.6});
    K.facade(w, fp, 'back', {floors, tile: (f) => (f === 0 ? 'wallDirt' : K.win('winB')), col: () => wall});
    for (let f = 1; f <= floors; f++) K.band(w, fp, f * FH - .14, .28, .1, 'cornice', lighten(wall, .5));
    K.flatRoof(w, fp, top, {col: wall}); K.tank(w, -W / 4, top + .18, -D / 4); K.tank(w, W / 4, top + .18, -D / 4);
    K.awning(w, -W / 2 + .3, W / 2 - .3, 2.6, fp.hd, 1.5, R.pick(AWN), .5);
    K.sign(w, o.sign ?? R.pick(['hotel', 'restaurant', 'grill']), 0, 3.35, fp.hd + .08, Math.min(W - 1, 9), 1.8);
    const sid = R.pick(['hotel', 'restaurant']); w.box(-3, top + 1.5, fp.hd - 1, .15, 2.6, .15, K.r('metal'), [.4, .4, .42], 'px nx pz nz'); w.box(3, top + 1.5, fp.hd - 1, .15, 2.6, .15, K.r('metal'), [.4, .4, .42], 'px nx pz nz');
    K.sign(w, sid, 0, top + 2.6, fp.hd - .9, 6.6, 1.65);
    return {hw: fp.hw, hd: fp.hd, h: top + 3.5, door: {x: 0, z: fp.hd + 1}, kind: 'hotel'};
  };

  /* ---------------------------------------------------------------- supermarket (parking apron, canopy, glass front) */
  B.supermarket = (x, y, z, rot, o = {}) => {
    const bays = o.bays ?? 7, W = bays * BAY, D = o.depth ?? 16, fh = 4.5, fp = {hw: W / 2, hd: D / 2}, w = K.newWriter(x, y, z, rot), wall = rgb(o.wall ?? '#f4f0e4'), mid = Math.floor(bays / 2);
    K.skirt(w, fp, .8);
    K.facade(w, fp, 'front', {floors: 1, fh, tile: (f, i) => (i === mid ? 'arcade' : 'glassSuper'), col: () => [1, 1, 1]});
    for (const s of ['right', 'left']) K.facade(w, fp, s, {floors: 1, fh, tile: (f, i) => (i % 3 === 1 ? 'goodsA' : 'wallDirt'), col: () => wall, bayW: 4});
    K.facade(w, fp, 'back', {floors: 1, fh, tile: () => 'wallDirt', col: () => wall});
    K.flatRoof(w, fp, fh, {parapet: 1.1, col: wall});
    w.box(0, fh - .1, fp.hd + 1.8, 3 * BAY, .3, 3.6, K.r('white'), [.95, .95, .95], 'px nx py pz ny');
    w.box(0, fh + .02, fp.hd + 3.6, 3 * BAY + .2, .5, .2, K.r('white'), [.87, .15, .15], 'pz px nx py');
    for (const sx of [-1, 1]) w.box(sx * (1.5 * BAY - .3), fh / 2 - .1, fp.hd + 3.3, .35, fh - .2, .35, K.r('white'), [.9, .9, .9], 'px nx pz nz');
    K.sign(w, o.sign ?? 'super', 0, fh + 1.15, fp.hd - .1, 11.5, 2.3);
    const ax = W / 2 + 3, az0 = fp.hd + 4.2, az1 = fp.hd + 20;
    w.quadGrid([-ax, .06, az1], [ax, .06, az1], [ax, .06, az0], [-ax, .06, az0], Math.round(ax * 2 / BAY), Math.round((az1 - az0) / BAY), K.r('concrete'), [.55, .56, .58]);
    for (let i = -4; i <= 4; i++) w.quad([i * 2.6 - .05, .075, az1 - 1], [i * 2.6 + .05, .075, az1 - 1], [i * 2.6 + .05, .075, az1 - 5.5], [i * 2.6 - .05, .075, az1 - 5.5], K.r('white'), [.95, .95, .95]);
    return {hw: fp.hw + 3, hd: fp.hd + 20, h: fh + 3.4, door: {x: 0, z: fp.hd + 3}, kind: 'supermarket', apron: {x0: -ax, x1: ax, z0: fp.hd + 4, z1: az1}};
  };

  /* ---------------------------------------------------------------- tea shop (enterable) */
  B.teaShop = (x, y, z, rot, o = {}) => {
    const W = 6.4, D = 5.6, fh = 3.1, fp = {hw: W / 2, hd: D / 2}, w = K.newWriter(x, y, z, rot), wall = rgb(o.wall ?? R.pick(['#e9d9a8', '#cfe3d4', '#efd9c4', '#d6e0ee'])), tint = K.roofTint();
    K.skirt(w, fp, .8); K.boxT(w, 0, .12, 0, W + .2, .24, D + .2, 'stone', [.7, .7, .68], 'px nx pz nz py'); const py = .24;
    K.facade(w, fp, 'front', {y0: py, floors: 1, fh, tile: () => 'shopTea', col: () => lighten(wall, .55)});
    for (const s of ['right', 'left']) K.facade(w, fp, s, {y0: py, floors: 1, fh, tile: (f, i) => (i === 0 ? K.win('winA') : 'wallDirt'), col: () => wall, bayW: 2.9});
    K.facade(w, fp, 'back', {y0: py, floors: 1, fh, tile: (f, i) => (i === 1 ? 'blankAC' : 'wallDirt'), col: () => wall});
    K.gable(w, fp.hw, fp.hd, py + fh, 1.7, .6, tint, {gableTile: 'wall', gableCol: wall, ovEnd: .55});
    const zv = fp.hd + 1.7; K.shed(w, -W / 2 - .3, W / 2 + .3, fp.hd + .1, zv + .35, py + fh + .15, py + fh - .55, tint);
    for (const sx of [-1, 1]) K.column(w, sx * (W / 2 - .3), py, zv - .1, fh - .62, .22);
    w.box(0, py + .25, fp.hd + .7, 2.6, .08, .55, K.r('woodLight'), [1, 1, 1], 'py px nx pz'); for (const sx of [-1, 1]) w.box(sx * 1.1, py + .12, fp.hd + .7, .08, .24, .5, K.r('woodDark'), [1, 1, 1], 'px nx pz');
    K.sign(w, o.sign ?? R.pick(['tea1', 'tea2', 'tea3']), 0, py + fh - .2, zv + .4, 3.8, .95);
    w.cyl(-W / 2 + .9, py + fh, -D / 2 + .7, .22, .18, 2.2, 8, K.r('brick'), [1, 1, 1]);
    return {hw: fp.hw + .6, hd: zv + .5, h: py + fh + 2.4, door: {x: 0, z: zv + .6}, kind: 'teashop'};
  };

  /* ---------------------------------------------------------------- petrol station */
  B.petrol = (x, y, z, rot) => {
    const w = K.newWriter(x, y, z, rot), ch = 5.4;
    w.quadGrid([-12, .05, 18], [12, .05, 18], [12, .05, -6], [-12, .05, -6], 8, 8, K.r('concrete'), [.5, .52, .54]);
    w.box(0, ch + .25, 6, 15, .5, 8.6, K.r('white'), [.97, .97, .97], 'px nx py pz nz ny');
    w.box(0, ch + .25, 10.35, 15.2, .62, .16, K.r('white'), [.86, .13, .13], 'pz px nx'); w.box(0, ch + .25, 1.65, 15.2, .62, .16, K.r('white'), [.86, .13, .13], 'nz px nx');
    for (const sx of [-1, 1]) for (const sz of [4, 8.5]) w.box(sx * 5.5, ch / 2, sz, .6, ch, .6, K.r('white'), [.93, .93, .9], 'px nx pz nz');
    for (const sx of [-4.2, 4.2]) for (const sz of [5, 7.6]) { w.box(sx, .85, sz, .75, 1.7, .5, K.r('white'), [.86, .13, .13], 'px nx pz nz py'); w.box(sx, 1.45, sz + .26, .55, .5, .02, K.r('glassMobile'), [1, 1, 1], 'pz'); }
    const fp = {hw: 3.4, hd: 2.6}, off = w.child(0, 0, -3.6); K.facade(off, fp, 'front', {floors: 1, fh: 3.4, tile: (f, i) => (i ? 'glassSuper' : 'arcade'), col: () => [1, 1, 1], bayW: 3.4});
    for (const s of ['right', 'left', 'back']) K.facade(off, fp, s, {floors: 1, fh: 3.4, tile: () => 'wallDirt', col: () => [.94, .92, .88]});
    K.flatRoof(off, fp, 3.4, {col: [.9, .88, .85]}); K.sign(off, 'fuel', 0, 3.9, fp.hd + .08, 5.4, 1.35);
    w.box(10.5, 4, 14, .3, 8, .3, K.r('metal'), [.4, .4, .42], 'px nx pz nz'); K.sign(w, 'fuel', 10.5, 8.6, 14, 4.4, 1.1); K.sign(w, 'fuel', 10.5, 8.6, 13.84, 4.4, 1.1, {nz: -1});
    return {hw: 12, hd: 12, h: 9, door: {x: 0, z: 14}, kind: 'petrol', centerZ: 6};
  };

  /* ---------------------------------------------------------------- Hindu temple */
  B.temple = (x, y, z, rot, o = {}) => {
    const small = !!o.small, S = small ? .62 : 1, w = K.newWriter(x, y, z, rot), tint = [.95, .72, .6];
    const CW = 30 * S, CD = 26 * S, wallH = 2.4;
    const gate = 2.8; K.boxT(w, -(CW / 4 + gate / 4), wallH / 2, CD / 2, CW / 2 - gate / 2, wallH, .5, 'laterite', [1, 1, 1], 'pz nz py', 2.5);
    K.boxT(w, (CW / 4 + gate / 4), wallH / 2, CD / 2, CW / 2 - gate / 2, wallH, .5, 'laterite', [1, 1, 1], 'pz nz py', 2.5);
    K.boxT(w, 0, wallH / 2, -CD / 2, CW, wallH, .5, 'laterite', [1, 1, 1], 'pz nz py', 2.5); K.boxT(w, -CW / 2, wallH / 2, 0, .5, wallH, CD, 'laterite', [1, 1, 1], 'px nx py', 2.5); K.boxT(w, CW / 2, wallH / 2, 0, .5, wallH, CD, 'laterite', [1, 1, 1], 'px nx py', 2.5);
    for (const sx of [-1, 1]) K.boxT(w, sx * (gate / 2 + .7), 1.9, CD / 2, 1.4, 3.8, 3, 'white', [.95, .93, .88], 'px nx pz nz', 3);
    w.box(0, 3.4, CD / 2, gate + 2.8, .8, 3, K.r('white'), [.95, .93, .88], 'pz nz px nx');
    K.gable(w.child(0, 0, CD / 2), (gate + 3) / 2, 1.5, 3.8, 1.5, .5, tint, {gableTile: 'white', gableCol: [.9, .86, .8], ovEnd: .4});
    const sx0 = 0, sz0 = -1.5 * S, pl = 9 * S; K.boxT(w, sx0, .55, sz0, pl, 1.1, pl, 'plinth', [.9, .92, .96], 'px nx pz nz', 3); w.box(sx0, 1.12, sz0, pl, .06, pl, K.r('stone'), [.85, .85, .85], 'py');
    const sw = 6 * S; for (const s of ['front', 'right', 'back', 'left']) K.facade(w.child(sx0, 1.1, sz0), {hw: sw / 2, hd: sw / 2}, s, {floors: 1, fh: 3.4, tile: (f, i) => (s === 'front' && i === Math.floor(sw / BAY / 2) ? 'doorA' : 'wall'), col: () => [.97, .94, .88], bayW: sw});
    K.hip(w.child(sx0, 0, sz0), sw / 2, sw / 2, 1.1 + 3.4, .85, 1.5 * S + .4, tint, {ridge: false});
    K.hip(w.child(sx0, 0, sz0), sw / 2 - 1.2 * S, sw / 2 - 1.2 * S, 1.1 + 3.4 + 2.2 * S + 1.6, .95, .5, tint, {ridge: false});
    w.cyl(sx0, 1.1 + 3.4 + 2.2 * S + 1.6 + 2.2 * S, sz0, .38, .08, .9, 8, K.r('gold'), [1, 1, 1]); w.cyl(sx0, 1.1 + 3.4 + 2.2 * S + 1.6 + 2.2 * S + .8, sz0, .1, 0, 1.2, 6, K.r('gold'), [1, 1, 1]);
    const fz = 8.5 * S; w.cyl(0, 0, fz, .55, .45, .5, 8, K.r('stone'), [.9, .9, .9]); w.cyl(0, .5, fz, .2, .14, 12 * S + 4, 8, K.r('gold'), [1, 1, 1]);
    for (let i = 0; i < 5; i++) w.cyl(0, 2 + i * 1.8 * S, fz, .3, .3, .12, 8, K.r('gold'), [.95, .9, .8]);
    w.cyl(-3.5 * S, 0, fz - 1.5, .3, .22, 2.6, 6, K.r('stone'), [.8, .8, .78]);
    if (!small) { for (const sx of [-1, 1]) for (const sz of [0, 1]) K.column(w, sx * 2.2, 0, 3.2 + sz * 3, 2.9, .3); K.hip(w.child(0, 0, 4.7), 2.7, 2.2, 2.9, .5, .5, tint); }
    return {hw: CW / 2, hd: CD / 2, h: 12, door: {x: 0, z: CD / 2 + 1}, kind: 'temple'};
  };

  /* ---------------------------------------------------------------- church */
  const churchOn = w => {
    const NW = 8.4, ND = 16, wallH = 6.2, wall = [.97, .96, .93], tint = [.55, .5, .5];
    K.skirt(w, {hw: NW / 2, hd: ND / 2}, 1);
    const nave = w.child(0, 0, -1.5), fp = {hw: NW / 2, hd: ND / 2};
    for (const s of ['right', 'left']) K.facade(nave, fp, s, {floors: 1, fh: wallH, tile: () => K.win('winC'), col: () => wall, bayW: 4});
    K.facade(nave, fp, 'back', {floors: 1, fh: wallH, tile: () => 'wall', col: () => wall});
    K.band(nave, fp, 2, .25, .12, 'cornice', [1, 1, 1], 'right left');
    K.gable(nave.child(0, 0, 0, Math.PI / 2), ND / 2, NW / 2, wallH, 3, .5, tint, {gableTile: 'wall', gableCol: wall, ovEnd: .3});
    const tz = ND / 2 - 1.5 + 2.2, tw = 5.2, th = 12, tower = w.child(0, 0, tz), tfp = {hw: tw / 2, hd: tw / 2};
    for (const s of ['front', 'right', 'back', 'left']) K.facade(tower, tfp, s, {floors: 1, fh: th, tile: () => 'wall', col: () => wall, bayW: 6});
    for (const s of ['front', 'right', 'left']) K.facade(tower, tfp, s, {y0: 3, floors: 1, fh: 3.2, tile: () => K.win('winF'), col: () => wall, off: .02, bayW: 5.2});
    K.facade(tower, tfp, 'front', {floors: 1, fh: 3.1, tile: () => 'doorA', col: () => wall, off: .03, bayW: 5.2});
    K.hip(tower, tw / 2, tw / 2, th, 2.6, .35, [.5, .5, .55], {ridge: false});
    w.box(0, th + tw * .5 * 2.6 + 1.2, tz, .14, 1.8, .14, K.r('gold'), [1, 1, 1], 'px nx pz nz py'); w.box(0, th + tw * .5 * 2.6 + 1.5, tz, .8, .14, .14, K.r('gold'), [1, 1, 1], 'px nx pz nz py');
    return {hw: NW / 2 + .5, hd: ND / 2 + 3.5, h: th + 9, door: {x: 0, z: tz + tw / 2 + 1}, kind: 'church'};
  };
  B.church = (x, y, z, rot) => churchOn(K.newWriter(x, y, z, rot));

  /* ---------------------------------------------------------------- mosque */
  B.mosque = (x, y, z, rot) => {
    const w = K.newWriter(x, y, z, rot), S = 14, wallH = 6.4, green = [.22, .6, .36], white = [.97, .97, .94], fp = {hw: S / 2, hd: S / 2};
    K.skirt(w, fp, 1); K.boxT(w, 0, .3, 0, S + .6, .6, S + .6, 'plinth', [.9, .92, .96], 'px nx pz nz py');
    for (const s of ['front', 'right', 'back', 'left']) K.facade(w, fp, s, {y0: .6, floors: 1, fh: wallH, tile: (f, i) => (s === 'front' && i === 2 ? 'arcade' : 'winC'), col: () => white, bayW: 3.5});
    K.band(w, fp, .6 + wallH - .2, .5, .1, 'cornice', green); K.band(w, fp, 1.6, .22, .08, 'cornice', green);
    w.box(0, .6 + wallH + .12, 0, S + .2, .24, S + .2, K.r('white'), white, 'py');
    const dome = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; dome.push([Math.cos(a) * 4.6, Math.sin(a) * 4.3]); }
    w.cyl(0, .6 + wallH, 0, 4.7, 4.6, .8, 14, K.r('white'), white, {cap: false}); w.lathe(0, 0, dome, 14, K.r('white'), green, .6 + wallH + .8);
    w.cyl(0, .6 + wallH + .8 + 4.3, 0, .2, .05, 1.8, 6, K.r('gold'), [1, 1, 1]);
    for (const sx of [-1, 1]) {
      const mx = sx * (S / 2 - .1), mz = S / 2 - .1, mh = 16;
      w.cyl(mx, .6, mz, .85, .7, mh, 10, K.r('wall'), white, {cap: false}); w.cyl(mx, .6 + mh * .72, mz, 1.15, 1.15, .35, 10, K.r('white'), green);
      const md = []; for (let i = 0; i <= 5; i++) { const a = i / 5 * Math.PI / 2; md.push([Math.cos(a) * .9, Math.sin(a) * 1.3]); }
      w.lathe(mx, mz, md, 10, K.r('white'), green, .6 + mh); w.cyl(mx, .6 + mh + 1.3, mz, .08, .02, 1.1, 5, K.r('gold'), [1, 1, 1]);
    }
    return {hw: S / 2 + .5, hd: S / 2 + .5, h: 24, door: {x: 0, z: S / 2 + 1}, kind: 'mosque'};
  };

  /* ---------------------------------------------------------------- hut / fisherman house (thatch) */
  B.hut = (x, y, z, rot, o = {}) => {
    const W = o.W ?? R.range(4.6, 6), D = o.D ?? R.range(3.8, 4.8), h = 2.3, fp = {hw: W / 2, hd: D / 2}, w = K.newWriter(x, y, z, rot), wall = rgb(R.pick(['#e8dcc0', '#d9c9a0', '#cfe0d0']));
    K.skirt(w, fp, .8); K.boxT(w, 0, .2, 0, W + .1, .4, D + .1, 'laterite', [.9, .85, .8], 'px nx pz nz');
    K.facade(w, fp, 'front', {y0: .4, floors: 1, fh: h, tile: (f, i) => (i === 0 ? 'doorA' : K.win('winA')), col: () => wall, bayW: 2.6});
    for (const s of ['right', 'left', 'back']) K.facade(w, fp, s, {y0: .4, floors: 1, fh: h, tile: (f, i) => (i % 2 ? K.win('winA') : 'wall'), col: () => wall, bayW: 2.8});
    const eave = .4 + h, X = W / 2 + .55, Z = D / 2 + .55, rl = Math.max(0, X - Z), ry = eave + Z * .8, t = K.r('thatch'), c = [.95, .9, .8];
    w.quad([-X, eave, Z], [X, eave, Z], [rl, ry, 0], [-rl, ry, 0], t, c); w.quad([X, eave, -Z], [-X, eave, -Z], [-rl, ry, 0], [rl, ry, 0], t, scaleRGB(c, .93));
    w.tri([X, eave, Z], [X, eave, -Z], [rl, ry, 0], [t[0], t[1]], [t[2], t[1]], [t[0], t[3]], scaleRGB(c, .97)); w.tri([-X, eave, -Z], [-X, eave, Z], [-rl, ry, 0], [t[0], t[1]], [t[2], t[1]], [t[0], t[3]], scaleRGB(c, .9));
    return {hw: X, hd: Z, h: ry, door: {x: -W / 2 + 1.3, z: fp.hd + .5}, kind: 'hut'};
  };

  /* ---------------------------------------------------------------- roadside stall with tarpaulin */
  B.stall = (x, y, z, rot, o = {}) => {
    const w = K.newWriter(x, y, z, rot), W = o.W ?? 3.6, D = 2.2, goods = o.goods ?? R.pick(['goodsB', 'goodsC', 'goodsA', 'goodsD']), tarp = R.pick(['tarpBlue', 'tarpOrange']);
    w.box(0, .5, 0, W, 1, D * .6, K.r(goods), [1, 1, 1], 'pz'); w.box(0, 1.02, 0, W, .06, D * .6, K.r('woodLight'), [1, 1, 1], 'py');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.box(sx * (W / 2 - .06), 1.15, sz * (D / 2 - .1), .09, 2.3, .09, K.r('woodDark'), [1, 1, 1], 'px nx pz nz');
    const t = K.r(tarp); w.quad([-W / 2 - .15, 2.15, D / 2 + .3], [W / 2 + .15, 2.15, D / 2 + .3], [W / 2 + .15, 2.45, -D / 2], [-W / 2 - .15, 2.45, -D / 2], t, [1, 1, 1]);
    w.quad([-W / 2 - .15, 2.15, D / 2 + .3], [-W / 2 - .15, 2.45, -D / 2], [W / 2 + .15, 2.45, -D / 2], [W / 2 + .15, 2.15, D / 2 + .3], t, [.7, .7, .7]);
    for (let i = 0; i < 4; i++) w.box(-W / 2 + .7 + i * .8, .15, D / 2 - .1, .6, .3, .45, K.r('woodLight'), [.9, .8, .7], 'px nx py pz');
    return {hw: W / 2 + .3, hd: D / 2 + .5, h: 2.5, door: {x: 0, z: D / 2 + .8}, kind: 'stall'};
  };

  /* ---------------------------------------------------------------- bus shelters */
  B.busShelter = (x, y, z, rot, o = {}) => {
    const w = K.newWriter(x, y, z, rot), v = o.variant ?? R.int(0, 2), W = v === 1 ? 4 : 5.2, D = 1.9, tint = K.roofTint();
    w.box(0, .06, 0, W + .4, .12, D + .4, K.r('stone'), [.75, .76, .74], 'px nx py pz nz');
    if (v === 1) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.column(w, sx * (W / 2 - .2), .12, sz * (D / 2 - .2), 2.4, .22); K.hip(w, W / 2 - .1, D / 2 - .1, 2.5, .5, .5, tint); }
    else { for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.box(sx * (W / 2 - .06), 1.25, sz * (D / 2 - .06), .1, 2.5, .1, K.r('metal'), [.3, .3, .32], 'px nx pz nz');
      w.box(0, 2.6, 0, W + .3, .14, D + .3, K.r(v === 0 ? 'metal' : 'concrete'), v === 0 ? [.35, .55, .75] : [.9, .9, .88], 'px nx py pz nz ny'); w.box(0, 1.2, -D / 2 + .08, W - .2, 2.2, .08, K.r('glassDark'), [.9, .9, .9], 'pz'); }
    w.box(0, .48, -D / 2 + .5, W - .8, .07, .46, K.r('woodDark'), [.8, .35, .3], 'py pz'); w.box(0, .27, -D / 2 + .5, .08, .3, .4, K.r('metal'), [.3, .3, .3], 'px nx pz');
    K.sign(w, 'busstand', 0, 2.4, D / 2 + .22, 2.4, .6);
    return {hw: W / 2 + .2, hd: D / 2 + .2, h: 2.8, door: {x: 0, z: D / 2 + 1}, kind: 'shelter', variant: v};
  };

  /* ---------------------------------------------------------------- towers */
  B.cellTower = (x, y, z, rot, o = {}) => {
    const w = K.newWriter(x, y, z, rot), H = o.h ?? 38, legs = [0, 1, 2].map(i => i / 3 * Math.PI * 2), seg = 7, mt = K.r('white');
    const P = (i, t) => { const r = 3.2 * (1 - t) + .55 * t, a = legs[i]; return [Math.cos(a) * r, t * H, Math.sin(a) * r]; };
    for (let s = 0; s < seg; s++) { const t0 = s / seg, t1 = (s + 1) / seg, col = s % 2 ? [.88, .12, .1] : [.96, .96, .96]; for (let i = 0; i < 3; i++) { w.beam(P(i, t0), P(i, t1), .22, mt, col); w.beam(P(i, t0), P((i + 1) % 3, t1), .1, mt, [.8, .8, .8]); w.beam(P(i, t0), P((i + 1) % 3, t0), .1, mt, [.8, .8, .8]); } }
    for (let i = 0; i < 3; i++) w.box(Math.cos(legs[i] + .5) * 1.3, H - 1.8, Math.sin(legs[i] + .5) * 1.3, .5, 1.8, .22, K.r('white'), [.92, .92, .92], 'px nx pz nz py');
    w.box(0, 1.5, 0, 3, 3, 3, K.r('metal'), [.55, .58, .6], 'px nx py pz nz');
    return {hw: 3.5, hd: 3.5, h: H, door: {x: 0, z: 4}, kind: 'tower'};
  };

  /* ---------------------------------------------------------------- workshop shed (tin roof) */
  B.workshop = (x, y, z, rot, o = {}) => {
    const W = o.W ?? 9, D = o.D ?? 8, h = 4.2, fp = {hw: W / 2, hd: D / 2}, w = K.newWriter(x, y, z, rot), wall = rgb(R.pick(['#d8d4c8', '#c9d4d8', '#e0cfa8']));
    K.skirt(w, fp, .7);
    K.facade(w, fp, 'front', {floors: 1, fh: h, tile: (f, i) => (i === 1 ? 'shopRoll' : 'wallDirt'), col: () => wall});
    for (const s of ['right', 'left', 'back']) K.facade(w, fp, s, {floors: 1, fh: h, tile: () => 'wallDirt', col: () => wall, bayW: 3.6});
    const t = K.r('roofTin'), ry = h + 1.3, X = W / 2 + .4, Z = D / 2 + .5;
    w.quad([-X, h, Z], [X, h, Z], [X, ry, 0], [-X, ry, 0], t, [1, 1, 1]); w.quad([X, h, -Z], [-X, h, -Z], [-X, ry, 0], [X, ry, 0], t, [.88, .88, .88]);
    w.tri([W / 2, h, D / 2], [W / 2, h, -D / 2], [W / 2, ry - .05, 0], [t[0], t[1]], [t[2], t[1]], [t[0], t[3]], wall); w.tri([-W / 2, h, -D / 2], [-W / 2, h, D / 2], [-W / 2, ry - .05, 0], [t[0], t[1]], [t[2], t[1]], [t[0], t[3]], wall);
    K.sign(w, o.sign ?? 'workshop', 0, h - .5, fp.hd + .06, 5, 1.2);
    for (let i = 0; i < 3; i++) w.cyl(W / 2 + 1.1, 0, -2 + i * 1.2, .38, .38, .9, 8, K.r('metal'), [.2, .35, .65]);
    return {hw: W / 2 + .5, hd: D / 2 + .5, h: ry, door: {x: 0, z: fp.hd + 1}, kind: 'workshop'};
  };

  /* ---------------------------------------------------------------- parked motorcycle (cheap, static; small-detail bucket) */
  B.bike = (x, y, z, rot, o = {}) => {
    const w = K.B.writer('atlasS', x, y, z, rot), body = o.color || R.pick([[.75, .12, .1], [.12, .12, .14], [.15, .3, .62], [.82, .82, .8], [.5, .5, .52], [.9, .66, .12]]), dark = [.1, .1, .11], metal = K.r('metal'), white = K.r('white');
    w.box(0, .3, .62, .1, .6, .6, white, dark, 'px nx py pz nz'); w.box(0, .3, -.62, .1, .6, .6, white, dark, 'px nx py pz nz');
    w.box(0, .55, 0, .26, .32, .85, white, body, 'px nx py pz nz'); w.box(0, .78, .12, .24, .09, .5, white, [.06, .06, .07], 'px nx py');
    w.box(0, .95, -.5, .62, .05, .05, metal, [.3, .3, .32], 'py pz'); w.box(0, .7, -.52, .06, .55, .06, metal, [.4, .4, .42], 'px nx pz'); w.box(.15, .28, .18, .08, .1, .6, metal, [.5, .5, .5], 'px py');
    return {hw: .4, hd: 1, h: 1, door: {x: 0, z: 0}, kind: 'bike'};
  };
  return B;
}
