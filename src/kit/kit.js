import {rgb, mixRGB, scaleRGB} from './batcher.js';

export const FH = 3.3;           // storey height (m)
export const BAY = 3.2;          // facade bay width (m)
export const WALL_PALETTE = ['#f3ead6', '#f0dca0', '#b9d4dc', '#e8bfb4', '#c8dab0', '#f6f3ec', '#e2b970', '#d99a78', '#e9e2c8', '#bfd2b2'];
export const SHOP_PALETTE = ['#f2d94a', '#f08a3a', '#58b873', '#5a9ae0', '#ec6a98', '#f4efe2', '#e85a4a', '#3fb3b0', '#e9c36a'];
export const ROOF_TINTS = [[1, 1, 1], [.92, .86, .8], [.84, .8, .76], [.95, .98, .88], [1, .93, .86]];

const SIDES = (fp, s) => { const {hw, hd} = fp; return s === 'front' ? [-hw, hd, 1, 0, 2 * hw] : s === 'right' ? [hw, hd, 0, -1, 2 * hd] : s === 'back' ? [hw, -hd, -1, 0, 2 * hw] : [-hw, -hd, 0, 1, 2 * hd]; };

export class Kit {
  constructor(batcher, assets, rnd) { this.B = batcher; this.A = assets.facade.rects; this.S = assets.signs.rects; this.P = assets.posters; this.rnd = rnd; this.assets = assets; this.litChance = .3; this.signIds = assets.signs.ids; }
  r(name) { const r = this.A[name]; if (!r) throw new Error('unknown atlas tile ' + name); return r; }
  wallColor() { return rgb(this.rnd.pick(WALL_PALETTE)); }
  shopColor() { return rgb(this.rnd.pick(SHOP_PALETTE)); }
  roofTint() { return this.rnd.pick(ROOF_TINTS); }
  win(name, lit = this.rnd.chance(this.litChance)) { return lit ? name + '_lit' : name; }
  newWriter(x, y, z, rot) { return this.B.writer('atlas', x, y, z, rot); }

  /** One wall plane of a footprint built from atlas bays. tile(f,i,n) -> tile name | null; col(f,i,n) -> rgb */
  facade(w, fp, side, {y0 = 0, floors = 1, fh = FH, tile, col, off = 0, bayW = BAY}) {
    const [x0, z0, dx, dz, len] = SIDES(fp, side), n = Math.max(1, Math.round(len / bayW)), bw = len / n, nx = -dz, nz = dx;
    for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
      const t = tile(f, i, n); if (!t) continue;
      const c = col(f, i, n), v = 1 + (this.rnd() - .5) * .05, y = y0 + f * fh;
      const ax = x0 + dx * bw * i + nx * off, az = z0 + dz * bw * i + nz * off, bx = ax + dx * bw, bz = az + dz * bw;
      w.quad([ax, y, az], [bx, y, bz], [bx, y + fh, bz], [ax, y + fh, az], this.r(t), [c[0] * v, c[1] * v, c[2] * v]);
    }
    return n;
  }
  band(w, fp, y, h, out, tile = 'cornice', col = [1, 1, 1], sides = 'front right back left') {
    const {hw, hd} = fp, t = this.r(tile), o = out;
    if (sides.includes('front')) w.box(0, y + h / 2, hd + o / 2, 2 * hw + 2 * o, h, o, t, col, 'pz py nx px');
    if (sides.includes('back')) w.box(0, y + h / 2, -hd - o / 2, 2 * hw + 2 * o, h, o, t, col, 'nz py nx px');
    if (sides.includes('right')) w.box(hw + o / 2, y + h / 2, 0, o, h, 2 * hd, t, col, 'px py pz nz');
    if (sides.includes('left')) w.box(-hw - o / 2, y + h / 2, 0, o, h, 2 * hd, t, col, 'nx py pz nz');
  }
  /** Large box with faces tiled by `unit` metres so textures keep their scale. */
  boxT(w, cx, cy, cz, sx, sy, sz, tile, col = [1, 1, 1], faces = 'px nx py pz nz', unit = BAY) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, f = faces.split(' '), t = typeof tile === 'string' ? this.r(tile) : tile;
    const g = (a, b, c, d, lu, lv, shade) => w.quadGrid(a, b, c, d, Math.max(1, Math.round(lu / unit)), Math.max(1, Math.round(lv / unit)), t, scaleRGB(col, shade));
    if (f.includes('pz')) g([cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz], sx, sy, 1);
    if (f.includes('nz')) g([cx + hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz - hz], [cx - hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz - hz], sx, sy, .94);
    if (f.includes('px')) g([cx + hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz - hz], [cx + hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz + hz], sz, sy, .97);
    if (f.includes('nx')) g([cx - hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz + hz], [cx - hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz - hz], sz, sy, .91);
    if (f.includes('py')) g([cx - hx, cy + hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz], sx, sz, 1);
  }
  skirt(w, fp, depth, tile = 'plinth', col = [.8, .8, .8], extra = .05) { const {hw, hd} = fp; if (depth <= 0) return; this.boxT(w, 0, -depth / 2, 0, 2 * hw + extra * 2, depth, 2 * hd + extra * 2, tile, col, 'px nx pz nz'); }

  /* ---------------------------------------------------------- roofs (bucket: roof) */
  _roofUV(a, b, d) { const u = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 1.6, v = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / 1.6; return [0, 0, u, v]; }
  roofQuad(w, a, b, c, d, tint) { w.use('roof'); w.quad(a, b, c, d, this._roofUV(a, b, d), tint); w.use('atlas'); }
  roofTri(w, a, b, c, tint) { w.use('roof'); const u = Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.6; w.tri(a, b, c, [0, 0], [u, 0], [u / 2, Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / 1.6], tint); w.use('atlas'); }
  /** Gable roof, ridge parallel to local x. Returns ridge height. */
  gable(w, hw, hd, eaveY, rise, ov, tint, {gableTile = 'wall', gableCol = [1, 1, 1], trim = true, ovEnd = ov} = {}) {
    const X = hw + ovEnd, Z = hd + ov, ry = eaveY + rise;
    this.roofQuad(w, [-X, eaveY, Z], [X, eaveY, Z], [X, ry, 0], [-X, ry, 0], tint);
    this.roofQuad(w, [X, eaveY, -Z], [-X, eaveY, -Z], [-X, ry, 0], [X, ry, 0], scaleRGB(tint, .93));
    const t = this.r(gableTile), k = hd / Z;
    for (const s of [1, -1]) {
      const x = s * hw, y0 = eaveY - .02, hr = rise * k + .02;
      if (s > 0) w.tri([x, y0, hd], [x, y0, -hd], [x, y0 + hr, 0], [t[0], t[1]], [t[2], t[1]], [(t[0] + t[2]) / 2, t[3]], gableCol);
      else w.tri([x, y0, -hd], [x, y0, hd], [x, y0 + hr, 0], [t[0], t[1]], [t[2], t[1]], [(t[0] + t[2]) / 2, t[3]], gableCol);
    }
    if (trim) { const wd = this.r('woodDark'), dk = [.55, .4, .3]; for (const s of [1, -1]) { w.beam([s * X, eaveY - .05, Z], [s * X, ry + .02, 0], .12, wd, dk); w.beam([s * X, eaveY - .05, -Z], [s * X, ry + .02, 0], .12, wd, dk); } w.beam([-X, ry + .06, 0], [X, ry + .06, 0], .22, this.r('woodDark'), [.7, .45, .35]); }
    return ry;
  }
  /** Hip roof (ridge parallel to x, ridge half-length = max(0,hw-hd)). */
  hip(w, hw, hd, eaveY, slope, ov, tint, {ridge = true} = {}) {
    const X = hw + ov, Z = hd + ov, rl = Math.max(0, X - Z), rise = Z * slope, ry = eaveY + rise;
    this.roofQuad(w, [-X, eaveY, Z], [X, eaveY, Z], [rl, ry, 0], [-rl, ry, 0], tint);
    this.roofQuad(w, [X, eaveY, -Z], [-X, eaveY, -Z], [-rl, ry, 0], [rl, ry, 0], scaleRGB(tint, .93));
    this.roofTri(w, [X, eaveY, Z], [X, eaveY, -Z], [rl, ry, 0], scaleRGB(tint, .97));
    this.roofTri(w, [-X, eaveY, -Z], [-X, eaveY, Z], [-rl, ry, 0], scaleRGB(tint, .9));
    if (ridge && rl > .2) w.beam([-rl, ry + .05, 0], [rl, ry + .05, 0], .22, this.r('woodDark'), [.75, .42, .3]);
    return ry;
  }
  shed(w, x0, x1, zBack, zFront, yHi, yLo, tint) { this.roofQuad(w, [x0, yLo, zFront], [x1, yLo, zFront], [x1, yHi, zBack], [x0, yHi, zBack], tint); }
  flatRoof(w, fp, y, {parapet = .85, tile = 'parapet', col = [1, 1, 1], slab = 'concrete'} = {}) {
    const {hw, hd} = fp;
    w.box(0, y + .09, 0, 2 * hw + .1, .18, 2 * hd + .1, this.r(slab), [.85, .85, .82], 'py');
    if (parapet > 0) { const t = .22, p = this.r(tile), h = parapet, cy = y + .18 + h / 2;
      w.box(0, cy, hd + t / 2 - .06, 2 * hw + .2, h, t, p, col, 'pz px nx py'); w.box(0, cy, -hd - t / 2 + .06, 2 * hw + .2, h, t, p, col, 'nz px nx py');
      w.box(hw + t / 2 - .06, cy, 0, t, h, 2 * hd - .2, p, col, 'px pz nz py'); w.box(-hw - t / 2 + .06, cy, 0, t, h, 2 * hd - .2, p, col, 'nx pz nz py'); }
  }
  /* ---------------------------------------------------------- details */
  awning(w, x0, x1, y, z, depth, tile, drop = .55) {
    const t = this.r(tile), n = Math.max(1, Math.round((x1 - x0) / 1.6)), seg = (x1 - x0) / n;
    for (let i = 0; i < n; i++) { const a = x0 + seg * i, b = a + seg; w.quad([a, y - drop, z + depth], [b, y - drop, z + depth], [b, y, z], [a, y, z], t); }
    w.quad([x0, y - drop - .22, z + depth], [x1, y - drop - .22, z + depth], [x1, y - drop, z + depth], [x0, y - drop, z + depth], [t[0], t[1], t[2], t[1] + (t[3] - t[1]) * .35]);
    for (const xx of [x0, x1]) w.tri([xx, y, z], [xx, y - drop, z + depth], [xx, y - drop - .22, z + depth], [t[0], t[1]], [t[2], t[1]], [t[0], t[3]], [.8, .8, .8]);
  }
  balcony(w, cx, y, z, width, depth, {rail = 'railing', col = [1, 1, 1], slabTile = 'concrete'} = {}) {
    w.box(cx, y - .06, z + depth / 2, width, .14, depth, this.r(slabTile), [.9, .9, .88], 'px nx py pz nz ny');
    const rt = this.r(rail), h = 1;
    w.quad([cx - width / 2, y, z + depth], [cx + width / 2, y, z + depth], [cx + width / 2, y + h, z + depth], [cx - width / 2, y + h, z + depth], rt, col);
    w.quad([cx + width / 2, y, z + depth], [cx + width / 2, y, z], [cx + width / 2, y + h, z], [cx + width / 2, y + h, z + depth], rt, col);
    w.quad([cx - width / 2, y, z], [cx - width / 2, y, z + depth], [cx - width / 2, y + h, z + depth], [cx - width / 2, y + h, z], rt, col);
  }
  tank(w, x, y, z, r = .55, h = 1.15) { w.cyl(x, y, z, r, r * .92, h, 10, this.r('white'), [.12, .12, .13]); w.cyl(x, y + h, z, r * .92, r * .5, .12, 10, this.r('white'), [.1, .1, .11]); w.box(x, y + .06, z, r * 2.2, .12, r * 2.2, this.r('concrete'), [.6, .6, .6], 'px nx py pz nz'); }
  ac(w, x, y, z, nz = 1) { w.box(x, y, z + nz * .18, .85, .34, .36, this.r('white'), [.93, .93, .9], 'px nx py pz nz'); }
  sign(w, id, cx, cy, z, width, height, {nz = 1} = {}) {
    const r = this.S[id]; if (!r) return; w.use('sign');
    if (nz > 0) w.quad([cx - width / 2, cy - height / 2, z], [cx + width / 2, cy - height / 2, z], [cx + width / 2, cy + height / 2, z], [cx - width / 2, cy + height / 2, z], r, [1, 1, 1]);
    else w.quad([cx + width / 2, cy - height / 2, z], [cx - width / 2, cy - height / 2, z], [cx - width / 2, cy + height / 2, z], [cx + width / 2, cy + height / 2, z], r, [1, 1, 1]);
    w.use('atlas');
  }
  /** Roof hoarding: steel legs + a large painted panel (bucket: billboard). Local coords of writer w. */
  hoarding(w, x, y, z, width, height, {key = null} = {}) {
    const P = this.P, bk = key || this.rnd.pick(P.billList), r = P.billboards[bk]; if (!r) return;
    const metal = this.r('metal'), hw = width / 2;
    for (const sx of [-1, 1]) w.box(sx * (hw - .4), y + height / 2 - .3, z - .25, .14, height + .6, .14, metal, [.32, .33, .35], 'px nx pz nz');
    w.box(0, y - .12, z, width + .3, .16, .5, metal, [.3, .3, .32], 'px nx py pz nz'); w.box(0, y + height + .06, z, width + .3, .12, .3, metal, [.32, .33, .35], 'px nx py pz nz');
    w.use('billboard');
    w.quad([-hw, y, z + .02], [hw, y, z + .02], [hw, y + height, z + .02], [-hw, y + height, z + .02], r, [1, 1, 1]);
    w.quad([hw, y, z - .52], [-hw, y, z - .52], [-hw, y + height, z - .52], [hw, y + height, z - .52], r, [.7, .7, .7]);
    w.use('atlas');
  }
  column(w, x, y, z, h, size = .26, tile = 'pillar', col = [1, 1, 1]) {
    w.box(x, y + h / 2, z, size, h, size, this.r(tile), col, 'px nx pz nz py');
    w.box(x, y + .12, z, size * 1.5, .24, size * 1.5, this.r('stone'), [.8, .8, .78], 'px nx pz nz py');
    w.box(x, y + h - .1, z, size * 1.4, .2, size * 1.4, this.r('woodDark'), [.8, .6, .5], 'px nx pz nz');
  }
}
