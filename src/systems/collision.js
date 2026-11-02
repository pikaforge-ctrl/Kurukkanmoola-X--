// Spatial-hash collision world for the XZ plane.
// Every solid object (building, wall segment, bus shelter, tree trunk...) is an oriented box. Rotation follows three.js
// `rotation.y`:  world.x = cx + lx*cos + lz*sin   world.z = cz - lx*sin + lz*cos
// Each collider keeps minX/maxX/minZ/maxZ so legacy consumers still work, and gains exact oriented tests and an O(1) broadphase.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class CollisionWorld {
  constructor(cell = 32) { this.cell = cell; this.grid = new Map(); this.all = []; }

  /** Add an oriented box. w = extent along local x, d = extent along local z. */
  add({x, z, w, d, rot = 0, baseY = 0, height = 30, kind = 'building', ref = null}) {
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
    const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    const o = {cx: x, cz: z, hw, hd, c, s, rot, minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez, baseY, height, kind, ref};
    this.all.push(o);
    const cs = this.cell;
    for (let iz = Math.floor(o.minZ / cs); iz <= Math.floor(o.maxZ / cs); iz++)
      for (let ix = Math.floor(o.minX / cs); ix <= Math.floor(o.maxX / cs); ix++) {
        const k = ix * 73856093 ^ iz * 19349663; let list = this.grid.get(k);
        if (!list) this.grid.set(k, list = []);
        list.push(o);
      }
    return o;
  }
  remove(o) {
    const i = this.all.indexOf(o); if (i >= 0) this.all.splice(i, 1);
    const cs = this.cell;
    for (let iz = Math.floor(o.minZ / cs); iz <= Math.floor(o.maxZ / cs); iz++)
      for (let ix = Math.floor(o.minX / cs); ix <= Math.floor(o.maxX / cs); ix++) { const list = this.grid.get(ix * 73856093 ^ iz * 19349663); if (list) { const j = list.indexOf(o); if (j >= 0) list.splice(j, 1); } }
  }
  candidates(minX, maxX, minZ, maxZ) {
    const cs = this.cell, out = [], stamp = (this._stamp = (this._stamp || 0) + 1);
    for (let iz = Math.floor(minZ / cs); iz <= Math.floor(maxZ / cs); iz++)
      for (let ix = Math.floor(minX / cs); ix <= Math.floor(maxX / cs); ix++) {
        const list = this.grid.get(ix * 73856093 ^ iz * 19349663); if (!list) continue;
        for (const o of list) if (o._st !== stamp) { o._st = stamp; out.push(o); }
      }
    return out;
  }
  /** Does a circle (x,z,r) touch any solid whose vertical span overlaps [y0,y1]? Returns the collider or null. */
  circleHits(x, z, r, y0 = -Infinity, y1 = Infinity, ignoreKinds = null) {
    for (const o of this.candidates(x - r, x + r, z - r, z + r)) {
      if (o.baseY + o.height < y0 || o.baseY > y1) continue;
      if (ignoreKinds && ignoreKinds.includes(o.kind)) continue;
      const dx = x - o.cx, dz = z - o.cz, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      const qx = clamp(lx, -o.hw, o.hw), qz = clamp(lz, -o.hd, o.hd);
      if ((lx - qx) ** 2 + (lz - qz) ** 2 < r * r) return o;
    }
    return null;
  }
  pointInside(x, z, y = null, only = null) {
    for (const o of this.candidates(x, x, z, z)) {
      if (y !== null && (y < o.baseY || y > o.baseY + o.height)) continue;
      if (only && !only.includes(o.kind)) continue;
      const dx = x - o.cx, dz = z - o.cz, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      if (Math.abs(lx) <= o.hw && Math.abs(lz) <= o.hd) return o;
    }
    return null;
  }
  /** Smallest push that moves a circle out of every overlapping solid. Returns {x,z,hit}. */
  pushOut(x, z, r, y0 = -Infinity, y1 = Infinity) {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const o of this.candidates(x - r, x + r, z - r, z + r)) {
        if (o.baseY + o.height < y0 || o.baseY > y1) continue;
        const dx = x - o.cx, dz = z - o.cz, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
        const qx = clamp(lx, -o.hw, o.hw), qz = clamp(lz, -o.hd, o.hd);
        let nx = lx - qx, nz = lz - qz, d2 = nx * nx + nz * nz, px, pz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; px = nx * k; pz = nz * k; }
        else { const ox = o.hw - Math.abs(lx), oz = o.hd - Math.abs(lz); if (ox < oz) { px = Math.sign(lx || 1) * (ox + r); pz = 0; } else { px = 0; pz = Math.sign(lz || 1) * (oz + r); } }
        x += px * o.c + pz * o.s; z += -px * o.s + pz * o.c; moved = hit = true;
      }
      if (!moved) break;
    }
    return {x, z, hit};
  }
  /** Oriented-box overlap (SAT): keeps generated buildings from intersecting. Negative margin lets touching boxes pass. */
  overlapsBox(x, z, w, d, rot = 0, margin = 0) {
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2 + margin, hd = d / 2 + margin;
    const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    for (const o of this.candidates(x - ex, x + ex, z - ez, z + ez)) if (satOverlap(x, z, hw, hd, c, s, o.cx, o.cz, o.hw, o.hd, o.c, o.s)) return o;
    return null;
  }
  /** March along a ray and return the first t inside a solid (optionally only solids of given kinds). */
  rayDistance(ox, oy, oz, dx, dy, dz, maxT, step = 0.5, only = null) {
    for (let t = step; t <= maxT; t += step) if (this.pointInside(ox + dx * t, oz + dz * t, oy + dy * t, only)) return t;
    return Infinity;
  }
}
function satOverlap(ax, az, ahw, ahd, ac, as, bx, bz, bhw, bhd, bc, bs) {
  const dx = bx - ax, dz = bz - az, axes = [[ac, -as], [as, ac], [bc, -bs], [bs, bc]];
  for (const [ux, uz] of axes) {
    const ra = ahw * Math.abs(ac * ux - as * uz) + ahd * Math.abs(as * ux + ac * uz), rb = bhw * Math.abs(bc * ux - bs * uz) + bhd * Math.abs(bs * ux + bc * uz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
  }
  return true;
}
