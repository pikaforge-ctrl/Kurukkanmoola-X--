import * as THREE from 'three';
import {mulberry32, clamp, TAU} from '../kit/util.js';

/* Water material: MeshStandardMaterial patched with a two-phase flow-map normal animation (no visible looping), depth-based
 * shallow/deep colour and opacity (banks show the bed, rivers are dark in the middle), shoreline foam, rapids foam (fast flow)
 * and wave displacement that fades near the bank so the plane never pokes through the terrain. All of it is cheap vertex data. */
export function createWaterMaterial(waterTex, {fall = false} = {}) {
  const uniforms = {uTime: {value: 0}, uNormal: {value: waterTex.normal}, uFoam: {value: waterTex.foam}, uShallow: {value: new THREE.Color('#5f9a86')}, uDeep: {value: new THREE.Color('#10404a')}};
  const m = new THREE.MeshStandardMaterial({color: '#2a6b72', roughness: .08, metalness: 0, transparent: true, opacity: 1, depthWrite: false, envMapIntensity: 1.25});
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec2 aFlow; attribute float aDepth;
uniform float uTime; varying vec2 vWXZ; varying vec2 vFlow; varying float vDepth;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vWXZ = position.xz; vFlow = aFlow; vDepth = aDepth;
float amp = smoothstep(0.02, 0.9, aDepth) * (${fall ? '0.0' : '1.0'});
float spd = length(aFlow);
transformed.y += (sin(position.x * .27 + uTime * 1.25 + position.z * .19) + sin(position.z * .43 - uTime * 1.6 + position.x * .11)) * .035 * amp * (1.0 + spd * .6);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform sampler2D uNormal; uniform sampler2D uFoam; uniform vec3 uShallow; uniform vec3 uDeep;
varying vec2 vWXZ; varying vec2 vFlow; varying float vDepth;
vec3 flowNormal(vec2 xz, vec2 flow, float scale, float speed, float t) {
  float p1 = fract(t * speed), p2 = fract(t * speed + .5), w = abs(2. * p1 - 1.);
  vec3 a = texture2D(uNormal, xz * scale - flow * p1 * .55).xyz * 2. - 1.;
  vec3 b = texture2D(uNormal, xz * scale - flow * p2 * .55 + .37).xyz * 2. - 1.;
  return mix(a, b, w);
}`).replace('#include <color_fragment>', `#include <color_fragment>
float depthK = smoothstep(0.0, ${fall ? '0.5' : '2.4'}, vDepth);
diffuseColor.rgb = mix(uShallow, uDeep, depthK);
float spdF = length(vFlow);
float foamTex = texture2D(uFoam, vWXZ * .07 - vFlow * uTime * .35).r * .65 + texture2D(uFoam, vWXZ * .19 + vFlow * uTime * .2 + .3).r * .35;
float shore = smoothstep(.55, .0, vDepth) * (.35 + .65 * foamTex);
float rapids = smoothstep(1.0, 1.9, spdF) * foamTex * .85;
float foam = clamp(shore + rapids${fall ? ' + .55 + foamTex * .4' : ''}, 0., 1.);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93, .96, .96), foam * .85);
diffuseColor.a = mix(${fall ? '.55' : '.32'}, .96, smoothstep(0., ${fall ? '.6' : '1.5'}, vDepth));
diffuseColor.a = max(diffuseColor.a, foam * .9);
diffuseColor.a = max(diffuseColor.a, smoothstep(2.4, 3.6, spdF) * .94);   // fast water (falls, steep rapids) is solid whitewater
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.9, .96, .98), smoothstep(2.4, 3.6, spdF) * .8);
diffuseColor.a *= smoothstep(0.0, 0.07, vDepth);`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(.5, .62, .68) * foam * .24;`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 n1 = flowNormal(vWXZ, vFlow, .045, .22 + spdF * .12, uTime);
  vec3 n2 = flowNormal(vWXZ, vFlow * 1.6, .13, .35 + spdF * .15, uTime + 3.1);
  vec3 nn = normalize(vec3((n1.xy + n2.xy * .6) * ${fall ? '.55' : '.42'} * (.5 + .5 * smoothstep(0., .6, vDepth)), 1.));
  vec3 nW = normalize(vec3(nn.x, 1.0, nn.y));
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}`);
  };
  m.customProgramCacheKey = () => 'kx-water-' + fall;
  m.userData.uniforms = uniforms;
  return m;
}

export class WaterSystem {
  constructor(scene, assets, W) {
    this.scene = scene; this.W = W; this.root = new THREE.Group(); this.root.name = 'water'; scene.add(this.root);
    this.material = createWaterMaterial(assets.water); this.fallMaterial = createWaterMaterial(assets.water, {fall: true});
    this.tiles = []; this.streamMeshes = []; this.cascades = []; this.stats = {water: 0, streams: 0, streamLength: 0};
  }

  /** Lakes, backwaters, rivers and the town canal: a 10 m raster that may overlap the bank by one cell (terrain hides the overlap). */
  buildBodies() {
    const {W} = this, STEP = 10, TILE = 400, riverNames = new Set(W.watercourses.map(w => w.name));
    const flowAt = (x, z) => {
      let best = Infinity, fx = 0, fz = 0;
      for (const w of W.watercourses) for (let i = 0; i < w.points.length - 1; i++) {
        const a = w.points[i], b = w.points[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1), d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) - w.width * .5;
        if (d < best) { best = d; const l = Math.sqrt(l2), drop = Math.abs((a[2] ?? 0) - (b[2] ?? 0)), sp = clamp(.45 + drop / l * 55, .45, 2.1); fx = dx / l * sp; fz = dz / l * sp; }
      }
      return [fx, fz];
    };
    const tiles = new Map(), cascades = this.cascades;
    for (let tz = -4150; tz < 4150; tz += TILE) for (let tx = -6000; tx < 6000; tx += TILE) {
      let any = false; for (let z = tz; z <= tz + TILE && !any; z += 40) for (let x = tx; x <= tx + TILE; x += 40) if (W.waterInfo(x, z).distance < 24) { any = true; break; }
      if (any) tiles.set(tx + ':' + tz, [tx, tz]);
    }
    for (const [tx, tz] of tiles.values()) {
      const pos = [], flow = [], depth = [], idx = [], vid = new Map(), nx = TILE / STEP + 1, infoCache = new Float32Array(nx * nx).fill(NaN);
      const dist = (i, j) => { const k = j * nx + i; if (Number.isNaN(infoCache[k])) infoCache[k] = W.waterInfo(tx + i * STEP, tz + j * STEP).distance; return infoCache[k]; };
      const vert = (i, j) => {
        const k = j * nx + i; let v = vid.get(k); if (v !== undefined) return v;
        const x = tx + i * STEP, z = tz + j * STEP, wi = W.waterInfo(x, z), th = W.terrainHeight(x, z); let level = wi.level, d = clamp(level - th, 0, 7);
        const onRiver = riverNames.has(wi.name); let fx = 0, fz = 0; if (onRiver) [fx, fz] = flowAt(x, z);
        if (level - th > 7.5) {   // falls / steep drop: the nominal level is far above the bed -> drape a shallow, fast, foamy cascade over the terrain instead of a floating sheet
          const gx = W.terrainHeight(x + 4, z) - W.terrainHeight(x - 4, z), gz = W.terrainHeight(x, z + 4) - W.terrainHeight(x, z - 4), gl = Math.hypot(gx, gz) || 1, sp = clamp(2.2 + gl / 8 * 5, 2.2, 6.5);
          level = th + 1.1; d = .03 + .2 * clamp(-wi.distance / 14, 0, 1); fx = -gx / gl * sp; fz = -gz / gl * sp; cascades.push([x, th, z]);
        }
        v = pos.length / 3; pos.push(x, level, z); depth.push(d); flow.push(onRiver ? fx : .06 * Math.cos(z * .003), onRiver ? fz : .04 * Math.sin(x * .004)); vid.set(k, v); return v;
      };
      for (let j = 0; j < nx - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const dd = Math.min(dist(i, j), dist(i + 1, j), dist(i, j + 1), dist(i + 1, j + 1)); if (dd > 9) continue;
        const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1);
        if (depth[a] <= 0 && depth[b] <= 0 && depth[c] <= 0 && depth[d] <= 0 && dd > 3) continue;
        idx.push(a, d, b, b, d, c);
      }
      if (!idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, k) => k % 3 === 1 ? 1 : 0), 3)); g.setIndex(idx); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.material); m.renderOrder = 2; m.userData.center = {x: tx + TILE / 2, z: tz + TILE / 2}; this.root.add(m); this.tiles.push(m); this.stats.water += idx.length / 3;
    }
    return this.stats;
  }

  /** Rocks flanking the falls, boulders in the plunge pool and animated spray where the water crashes down. */
  dressFalls(veg) {
    const rnd = mulberry32(2025), th = this.W.terrainHeight, c = this.cascades; if (!c.length) return;
    for (const [x, , z] of c) { if (rnd() < .5) continue; veg.add('rockBig', x + (rnd() < .5 ? -1 : 1) * (28 + rnd() * 9), th(x, z) - .2, z + (rnd() - .5) * 8, {rot: rnd() * TAU, scale: 3 + rnd() * 5, variant: Math.floor(rnd() * 2)}); }
    const base = c.reduce((a, p) => (p[1] < a[1] ? p : a), c[0]);
    for (let i = 0; i < 22; i++) { const a = rnd() * TAU, r = 6 + rnd() * 30, x = base[0] + Math.cos(a) * r, z = base[2] - 12 + Math.sin(a) * r; veg.add('rockBig', x, th(x, z) - .3, z, {rot: rnd() * TAU, scale: 1 + rnd() * 3, variant: Math.floor(rnd() * 2)}); }
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), grd = g.createRadialGradient(32, 32, 2, 32, 32, 30); grd.addColorStop(0, 'rgba(255,255,255,.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv); this.spray = [];
    for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true, depthWrite: false, opacity: .4})); sp.userData = {i, x: base[0] + (rnd() - .5) * 46, z: base[2] - 4 + (rnd() - .5) * 20, y: base[1] + 2}; this.root.add(sp); this.spray.push(sp); }
    this.sprayAnchor = base;
  }

  /** Rain-fed hill streams: steepest descent over the heightmap, stopping at water or at a road (culvert). */
  buildStreams({field, veg, count = 22}) {
    const {W} = this, rnd = mulberry32(4242), th = W.terrainHeight, STEP = 11; let made = 0;
    for (let n = 0; n < count * 40 && made < count; n++) {
      const x0 = -5800 + rnd() * 11600, z0 = -4000 + rnd() * 8000, h0 = th(x0, z0);
      if (h0 < 190 || h0 > 620 || !W.forestZone(x0, z0) || W.waterInfo(x0, z0).distance < 60 || field.clearance(x0, z0) < 25) continue;
      let x = x0, z = z0, dirx = 0, dirz = 0, ended = false; const pts = [[x, z]];
      for (let s = 0; s < 220; s++) {
        let bestH = th(x, z), bx = null, bz = null;
        for (let a = 0; a < 16; a++) { const ang = a / 16 * TAU, nx = x + Math.cos(ang) * STEP, nz = z + Math.sin(ang) * STEP, h = th(nx, nz) + (dirx * Math.cos(ang) + dirz * Math.sin(ang) < -.2 ? 2 : 0); if (h < bestH - .05) { bestH = h; bx = nx; bz = nz; } }
        if (bx === null) break;
        dirx = (bx - x) / STEP; dirz = (bz - z) / STEP; x = bx; z = bz; pts.push([x, z]);
        if (W.waterInfo(x, z).distance < 3) { ended = true; break; }
        if (field.clearance(x, z) < 2.2) break;   // meets a road: culvert
      }
      if (pts.length < 14 || (!ended && pts.length < 30)) continue;
      this._ribbon(pts); made++;
      if (veg) for (let i = 2; i < pts.length - 2; i += 2) for (const side of [-1, 1]) if (rnd() < .45) { const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1, off = (2.6 + rnd() * 2.2) * side, x2 = p[0] - dz / l * off, z2 = p[1] + dx / l * off; veg.add(rnd() < .2 ? 'rockBig' : 'rock', x2, th(x2, z2) - .1, z2, {rot: rnd() * TAU, scale: .5 + rnd() * 1.4, variant: Math.floor(rnd() * 2)}); }
    }
    return {streams: made, length: Math.round(this.stats.streamLength)};
  }
  _ribbon(raw) {
    let pts = raw; for (let it = 0; it < 2; it++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } o.push(pts[pts.length - 1]); pts = o; }
    const th = this.W.terrainHeight, pos = [], flow = [], depth = [], idx = [], n = pts.length; let len = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, t = i / (n - 1);
      const w = 1.4 + t * 2.4 + Math.sin(i * .7) * .3, p = pts[i]; if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      const slope = Math.abs(th(b[0], b[1]) - th(a[0], a[1])) / l, sp = clamp(.7 + slope * 7, .7, 2.6), y = th(p[0], p[1]) + .1;
      pos.push(p[0] - nx * w, y, p[1] - nz * w, p[0] + nx * w, y, p[1] + nz * w, p[0], y - .02, p[1]); depth.push(.12, .12, .65); flow.push(dx / l * sp, dz / l * sp, dx / l * sp, dz / l * sp, dx / l * sp, dz / l * sp);
    }
    for (let i = 0; i < n - 1; i++) { const a = i * 3, b = a + 3; idx.push(a, a + 2, b, b, a + 2, b + 2, a + 2, a + 1, b + 2, b + 2, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, k) => k % 3 === 1 ? 1 : 0), 3)); g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.material); m.renderOrder = 3; m.userData.center = {x: g.boundingSphere.center.x, z: g.boundingSphere.center.z, r: g.boundingSphere.radius};
    this.root.add(m); this.streamMeshes.push(m); this.stats.streams++; this.stats.streamLength += len;
  }

  update(t, p, quality = 'medium') {
    this.material.userData.uniforms.uTime.value = t; this.fallMaterial.userData.uniforms.uTime.value = t;
    if (this.spray) { const near = Math.hypot(this.sprayAnchor[0] - p.x, this.sprayAnchor[2] - p.z) < 1800; for (const sp of this.spray) { sp.visible = near; if (!near) continue; const k = (t * .3 + sp.userData.i * .17) % 1; sp.position.set(sp.userData.x + Math.sin(t + sp.userData.i) * 1.5, sp.userData.y + k * 22, sp.userData.z); sp.scale.setScalar(10 + k * 24); sp.material.opacity = (1 - k) * .3; } }
    const range = quality === 'low' ? 1600 : quality === 'high' ? 4200 : 2600;
    for (const m of this.tiles) m.visible = Math.hypot(m.userData.center.x - p.x, m.userData.center.z - p.z) < range + 280;
    for (const m of this.streamMeshes) m.visible = Math.hypot(m.userData.center.x - p.x, m.userData.center.z - p.z) < (quality === 'low' ? 700 : 1500) + m.userData.center.r;
  }
}
