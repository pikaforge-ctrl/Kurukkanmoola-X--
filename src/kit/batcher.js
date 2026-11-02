import * as THREE from 'three';

// Static geometry batcher.
// Buildings, walls, posters, poles... are authored with a tiny "writer" API (quad/box/cylinder/...) that
// transforms vertices to world space and appends them to a bucket keyed by (material, spatial cell).
// flush() turns every bucket into one THREE.Mesh, so a 320 m block of town costs a handful of draw calls and can be
// frustum/distance culled. No per-object Mesh, BufferGeometry or matrix is created while authoring.

export const rgb = c => {
  if (Array.isArray(c)) return c;
  const n = typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};
export const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const scaleRGB = (a, k) => [Math.min(1, a[0] * k), Math.min(1, a[1] * k), Math.min(1, a[2] * k)];

class Bucket {
  constructor(key, cx, cz) {
    this.key = key; this.cx = cx; this.cz = cz; this.cap = 2048; this.n = 0; this.ni = 0;
    this.pos = new Float32Array(this.cap * 3); this.nor = new Float32Array(this.cap * 3);
    this.uv = new Float32Array(this.cap * 2); this.col = new Uint8Array(this.cap * 4); this.idx = new Uint32Array(this.cap * 2);
  }
  ensure(v, i) {
    if (this.n + v > this.cap) {
      while (this.n + v > this.cap) this.cap *= 2;
      const g = (A, k, old) => { const a = new A(this.cap * k); a.set(old); return a; };
      this.pos = g(Float32Array, 3, this.pos); this.nor = g(Float32Array, 3, this.nor);
      this.uv = g(Float32Array, 2, this.uv); this.col = g(Uint8Array, 4, this.col);
    }
    if (this.ni + i > this.idx.length) { const a = new Uint32Array(Math.max(this.idx.length * 2, this.ni + i)); a.set(this.idx); this.idx = a; }
  }
}

export class Batcher {
  constructor(cell = 320) { this.cell = cell; this.buckets = new Map(); this.triangles = 0; }
  bucket(mat, x, z) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell), key = mat + ':' + cx + ':' + cz;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, b = new Bucket(mat, (cx + .5) * this.cell, (cz + .5) * this.cell));
    return b;
  }
  count() { let n = 0; for (const b of this.buckets.values()) n += b.ni / 3; return Math.round(n); }
  writer(mat = 'atlas', x = 0, y = 0, z = 0, rot = 0) { return new Writer(this, mat, x, y, z, rot); }
  world(mat = 'atlas') { return new WorldWriter(this, mat); }

  /** Build one mesh per bucket. `materials` maps bucket key -> THREE.Material. */
  flush(parent, materials, {shadowKeys = []} = {}) {
    const meshes = [];
    for (const b of this.buckets.values()) {
      if (!b.n) continue;
      const material = materials[b.key];
      if (!material) throw new Error('Batcher: no material for key ' + b.key);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(b.pos.slice(0, b.n * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(b.nor.slice(0, b.n * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(b.uv.slice(0, b.n * 2), 2));
      g.setAttribute('color', new THREE.BufferAttribute(b.col.slice(0, b.n * 4), 4, true));
      g.setIndex(new THREE.BufferAttribute(b.idx.slice(0, b.ni), 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, material);
      m.matrixAutoUpdate = false; m.receiveShadow = true; m.castShadow = shadowKeys.includes(b.key);
      m.userData.center = {x: b.cx, z: b.cz}; m.userData.key = b.key; m.userData.canCast = m.castShadow;
      parent.add(m); meshes.push(m);
      this.triangles += b.ni / 3;
    }
    this.buckets.clear();
    return meshes;
  }
}

export class Writer {
  constructor(batcher, mat, x, y, z, rot) {
    this.B = batcher; this.x = x; this.y = y; this.z = z; this.rot = rot; this.c = Math.cos(rot); this.s = Math.sin(rot);
    this.matKey = mat; this.b = batcher.bucket(mat, x, z); this.col = [1, 1, 1]; this._ox = x; this._oz = z;
  }
  /** Switch the destination material bucket (same placement). */
  use(mat) { this.matKey = mat; this.b = this.B.bucket(mat, this._ox, this._oz); return this; }
  color(c) { this.col = rgb(c); return this; }
  /** A writer for a sub-assembly positioned/rotated relative to this one. */
  child(dx = 0, dy = 0, dz = 0, drot = 0) {
    const w = new Writer(this.B, this.matKey, this.x + dx * this.c + dz * this.s, this.y + dy, this.z - dx * this.s + dz * this.c, this.rot + drot);
    w._ox = this._ox; w._oz = this._oz; w.b = this.B.bucket(this.matKey, this._ox, this._oz); w.col = this.col;
    return w;
  }
  wx(lx, lz) { return this.x + lx * this.c + lz * this.s; }
  wz(lx, lz) { return this.z - lx * this.s + lz * this.c; }

  _v(p, nx, ny, nz, u, v, col) {
    const b = this.b, i = b.n++, lx = p[0], ly = p[1], lz = p[2];
    b.pos[i * 3] = this.x + lx * this.c + lz * this.s; b.pos[i * 3 + 1] = this.y + ly; b.pos[i * 3 + 2] = this.z - lx * this.s + lz * this.c;
    b.nor[i * 3] = nx * this.c + nz * this.s; b.nor[i * 3 + 1] = ny; b.nor[i * 3 + 2] = -nx * this.s + nz * this.c;
    b.uv[i * 2] = u; b.uv[i * 2 + 1] = v;
    b.col[i * 4] = col[0] * 255; b.col[i * 4 + 1] = col[1] * 255; b.col[i * 4 + 2] = col[2] * 255; b.col[i * 4 + 3] = 255;
    return i;
  }

  /** Quad a,b,c,d counter-clockwise seen from the front. uv rect [u0,v0,u1,v1]: a->(u0,v0) b->(u1,v0) c->(u1,v1) d->(u0,v1). */
  quad(a, b, c, d, uv, col = this.col, shade = 1) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const cc = shade === 1 ? col : [col[0] * shade, col[1] * shade, col[2] * shade];
    this.b.ensure(4, 6);
    const i0 = this._v(a, nx, ny, nz, uv[0], uv[1], cc), i1 = this._v(b, nx, ny, nz, uv[2], uv[1], cc),
      i2 = this._v(c, nx, ny, nz, uv[2], uv[3], cc), i3 = this._v(d, nx, ny, nz, uv[0], uv[3], cc);
    const ix = this.b.idx; let k = this.b.ni;
    ix[k++] = i0; ix[k++] = i1; ix[k++] = i2; ix[k++] = i0; ix[k++] = i2; ix[k++] = i3; this.b.ni = k;
    return this;
  }
  /** Subdivide parallelogram a,b,c,d into nu x nv quads, each mapped to the full uv rect (keeps atlas tiles at metric scale). */
  quadGrid(a, b, c, d, nu, nv, uv, col = this.col) {
    const P = (u, v) => [a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v, a[2] + (b[2] - a[2]) * u + (d[2] - a[2]) * v];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) this.quad(P(i / nu, j / nv), P((i + 1) / nu, j / nv), P((i + 1) / nu, (j + 1) / nv), P(i / nu, (j + 1) / nv), uv, col);
    return this;
  }
  tri(a, b, c, uva, uvb, uvc, col = this.col, shade = 1) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const cc = shade === 1 ? col : [col[0] * shade, col[1] * shade, col[2] * shade];
    this.b.ensure(3, 3);
    const i0 = this._v(a, nx, ny, nz, uva[0], uva[1], cc), i1 = this._v(b, nx, ny, nz, uvb[0], uvb[1], cc), i2 = this._v(c, nx, ny, nz, uvc[0], uvc[1], cc);
    const ix = this.b.idx; let k = this.b.ni; ix[k++] = i0; ix[k++] = i1; ix[k++] = i2; this.b.ni = k;
    return this;
  }
  _smoothQuad(p, nrm, uvs, col) {
    this.b.ensure(4, 6);
    const i = [0, 1, 2, 3].map(k => this._v(p[k], nrm[k][0], nrm[k][1], nrm[k][2], uvs[k][0], uvs[k][1], col));
    const ix = this.b.idx; let k = this.b.ni; ix[k++] = i[0]; ix[k++] = i[1]; ix[k++] = i[2]; ix[k++] = i[0]; ix[k++] = i[2]; ix[k++] = i[3]; this.b.ni = k;
  }

  /** Axis-aligned (local) box. `rect` = one uv rect or {px,nx,py,ny,pz,nz}; faces = space separated face ids. */
  box(cx, cy, cz, sx, sy, sz, rect, col = this.col, faces = 'px nx py pz nz') {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, f = faces.split(' ');
    const R = id => (Array.isArray(rect) ? rect : rect[id] || rect.all || rect.px);
    const C = (id, shade) => { const c = col.top || col.side ? (id === 'py' ? col.top || col.side : col.side || col.top) : col; return shade ? [c[0] * shade, c[1] * shade, c[2] * shade] : c; };
    if (f.includes('pz')) this.quad([cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz], R('pz'), C('pz', 1));
    if (f.includes('nz')) this.quad([cx + hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz - hz], [cx - hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz - hz], R('nz'), C('nz', .94));
    if (f.includes('px')) this.quad([cx + hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz - hz], [cx + hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz + hz], R('px'), C('px', .97));
    if (f.includes('nx')) this.quad([cx - hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz + hz], [cx - hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz - hz], R('nx'), C('nx', .91));
    if (f.includes('py')) this.quad([cx - hx, cy + hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz], R('py'), C('py', 1));
    if (f.includes('ny')) this.quad([cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz + hz], [cx - hx, cy - hy, cz + hz], R('ny'), C('ny', .6));
    return this;
  }
  /** Vertical-ish tapered cylinder with smooth normals; r0 at y0 and r1 at y0+h. */
  cyl(cx, y0, cz, r0, r1, h, seg, rect, col = this.col, {cap = true, lean = [0, 0], uvTurns = 1, uvLen = 1} = {}) {
    const ring = (y, r, off) => { const o = []; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; o.push([cx + Math.cos(a) * r + off[0], y, cz + Math.sin(a) * r + off[1]]); } return o; };
    const A = ring(y0, r0, [0, 0]), B = ring(y0 + h, r1, lean), slope = (r0 - r1) / Math.max(h, 1e-4);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const n0 = [Math.cos(a0), slope, Math.sin(a0)], n1 = [Math.cos(a1), slope, Math.sin(a1)];
      const u0 = rect[0] + (rect[2] - rect[0]) * (i / seg) * uvTurns, u1 = rect[0] + (rect[2] - rect[0]) * ((i + 1) / seg) * uvTurns;
      const vTop = rect[1] + (rect[3] - rect[1]) * uvLen;
      this._smoothQuad([A[i], A[i + 1], B[i + 1], B[i]], [n0, n1, n1, n0], [[u0, rect[1]], [u1, rect[1]], [u1, vTop], [u0, vTop]], col);
    }
    if (cap && r1 > .01) for (let i = 0; i < seg; i++) {
      const c0 = [cx + lean[0], y0 + h, cz + lean[1]];
      this.tri(c0, B[i + 1], B[i], [rect[0], rect[1]], [rect[0], rect[1]], [rect[0], rect[1]], col);
    }
    return this;
  }
  /** Surface of revolution about the local Y axis through (cx,cz). profile: [[radius,y],...] bottom -> top. */
  lathe(cx, cz, profile, seg, rect, col = this.col, y0 = 0) {
    for (let j = 0; j < profile.length - 1; j++) {
      const [r0, h0] = profile[j], [r1, h1] = profile[j + 1], dr = r1 - r0, dh = h1 - h0, l = Math.hypot(dr, dh) || 1, ny = -dr / l, nr = dh / l;
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const u0 = rect[0] + (rect[2] - rect[0]) * i / seg, u1 = rect[0] + (rect[2] - rect[0]) * (i + 1) / seg;
        const v0 = rect[1] + (rect[3] - rect[1]) * j / (profile.length - 1), v1 = rect[1] + (rect[3] - rect[1]) * (j + 1) / (profile.length - 1);
        this._smoothQuad([[cx + c0 * r0, y0 + h0, cz + s0 * r0], [cx + c1 * r0, y0 + h0, cz + s1 * r0], [cx + c1 * r1, y0 + h1, cz + s1 * r1], [cx + c0 * r1, y0 + h1, cz + s0 * r1]],
          [[c0 * nr, ny, s0 * nr], [c1 * nr, ny, s1 * nr], [c1 * nr, ny, s1 * nr], [c0 * nr, ny, s0 * nr]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], col);
      }
    }
    return this;
  }
  /** Beam between two local points (square cross-section, thickness t). */
  beam(a, b, t, rect, col = this.col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz) || 1;
    let px = 0, py = 1, pz = 0; if (Math.abs(dy / l) > .9) { px = 1; py = 0; }
    let ax = dy * pz - dz * py, ay = dz * px - dx * pz, az = dx * py - dy * px; const al = Math.hypot(ax, ay, az) || 1; ax = ax / al * t / 2; ay = ay / al * t / 2; az = az / al * t / 2;
    let bx = (dy * az - dz * ay) / l, by = (dz * ax - dx * az) / l, bz = (dx * ay - dy * ax) / l; const bl = Math.hypot(bx, by, bz) || 1; bx = bx / bl * t / 2; by = by / bl * t / 2; bz = bz / bl * t / 2;
    const P = (o, sa, sb) => [o[0] + ax * sa + bx * sb, o[1] + ay * sa + by * sb, o[2] + az * sa + bz * sb];
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 4; i++) { const [s1, t1] = c[i], [s2, t2] = c[(i + 1) % 4]; this.quad(P(a, s1, t1), P(a, s2, t2), P(b, s2, t2), P(b, s1, t1), rect, col, .85 + i * .05); }
    return this;
  }
}

/** Writer for world-space geometry (roads, walls...): picks the destination cell per primitive instead of per writer. */
export class WorldWriter extends Writer {
  constructor(batcher, mat) { super(batcher, mat, 0, 0, 0, 0); }
  use(mat) { this.matKey = mat; return this; }
  quad(a, b, c, d, uv, col, shade) { this.b = this.B.bucket(this.matKey, (a[0] + c[0]) / 2, (a[2] + c[2]) / 2); return super.quad(a, b, c, d, uv, col, shade); }
  tri(a, b, c, ua, ub, uc, col, shade) { this.b = this.B.bucket(this.matKey, (a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3); return super.tri(a, b, c, ua, ub, uc, col, shade); }
  /** a normal Writer anchored at world (x,y,z) for boxes/cylinders (bucket by origin). */
  at(x, y, z, rot = 0, mat = this.matKey) { return new Writer(this.B, mat, x, y, z, rot); }
}
