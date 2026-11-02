// Road clearance field: for every 4 m cell, the distance from the cell centre to the nearest road *edge* (0 on the carriageway),
// capped at ~42 m. world-layout.nearestRoad() scans every segment of a 160 m bucket (~24 us in the dense town); placement code
// needs hundreds of thousands of look-ups, so this turns them into a bilinear texture fetch.
const CELL = 4, SCALE = 6, CAP = 255 / SCALE;
export class RoadField {
  constructor(segments, bounds) {
    this.x0 = bounds.minX; this.z0 = bounds.minZ;
    this.nx = Math.ceil((bounds.maxX - bounds.minX) / CELL) + 1; this.nz = Math.ceil((bounds.maxZ - bounds.minZ) / CELL) + 1;
    this.data = new Uint8Array(this.nx * this.nz).fill(255);
    const R = CAP + 2;
    for (const s of segments) {
      const half = s.width / 2, ax = s.a[0], az = s.a[1], bx = s.b[0], bz = s.b[1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, rr = R + half;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - rr - this.x0) / CELL)), i1 = Math.min(this.nx - 1, Math.ceil((Math.max(ax, bx) + rr - this.x0) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - rr - this.z0) / CELL)), j1 = Math.min(this.nz - 1, Math.ceil((Math.max(az, bz) + rr - this.z0) / CELL));
      for (let j = j0; j <= j1; j++) { const z = this.z0 + j * CELL, row = j * this.nx;
        for (let i = i0; i <= i1; i++) { const x = this.x0 + i * CELL, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t) - half, v = d <= 0 ? 0 : Math.min(255, Math.round(d * SCALE)); if (v < this.data[row + i]) this.data[row + i] = v; } }
    }
  }
  clearance(x, z) {
    const fx = (x - this.x0) / CELL, fz = (z - this.z0) / CELL;
    if (fx < 0 || fz < 0 || fx >= this.nx - 1 || fz >= this.nz - 1) return CAP;
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, d = this.data, o = j * this.nx + i, a = d[o], b = d[o + 1], c = d[o + this.nx], e = d[o + this.nx + 1];
    return ((a + (b - a) * tx) * (1 - tz) + (c + (e - c) * tx) * tz) / SCALE;
  }
}
