import * as THREE from 'three';
import {mulberry32, TAU} from '../kit/util.js';

/** Street dogs (a handful of simple animated meshes) and bird flocks (one InstancedMesh per species). */
export function createFauna({scene, surfaceHeight, collision, field, town, roadside, W, dogCount = 11}) {
  const R = mulberry32(1357), dogs = [], tmp = new THREE.Object3D();
  const coats = [['#b98c52', '#6b4a24'], ['#2a2623', '#14110f'], ['#d8d0c0', '#8a7e6a'], ['#8c6a44', '#3e2c1a']], mats = coats.map(([a, b]) => ({a: new THREE.MeshStandardMaterial({color: a, roughness: .95}), b: new THREE.MeshStandardMaterial({color: b, roughness: .95})}));
  const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  function makeDog(coat) {
    const g = new THREE.Group(), m = mats[coat], add = (geo, mat, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o); return o; };
    const body = new THREE.Group(); g.add(body); add(boxG(.2, .24, .6), m.a, 0, .42, 0, body); add(boxG(.17, .18, .2), m.a, 0, .55, -.35, body); add(boxG(.09, .08, .12), m.b, 0, .5, -.46, body);
    add(boxG(.05, .09, .04), m.b, -.06, .67, -.34, body); add(boxG(.05, .09, .04), m.b, .06, .67, -.34, body);
    const tail = new THREE.Group(); tail.position.set(0, .5, .3); body.add(tail); add(boxG(.04, .04, .24), m.b, 0, .06, .1, tail); tail.rotation.x = -.7;
    const legs = []; for (const [x, z] of [[-.07, -.22], [.07, -.22], [-.07, .22], [.07, .22]]) { const l = new THREE.Group(); l.position.set(x, .32, z); add(boxG(.06, .32, .06), m.a, 0, -.16, 0, l); g.add(l); legs.push(l); }
    g.userData = {body, tail, legs}; return g;
  }
  const homes = [...town.standSpots.map(s => ({x: s.x + Math.sin(s.yaw) * 3, z: s.z + Math.cos(s.yaw) * 3})), ...roadside.busStops.map(b => ({x: b.x, z: b.z}))];
  for (let n = 0; n < 200 && dogs.length < dogCount; n++) {
    const h = homes[(R() * homes.length) | 0]; if (!h) break; const x = h.x + R.range(-3, 3), z = h.z + R.range(-3, 3); if (field.clearance(x, z) < .4 || collision.circleHits(x, z, .5)) continue;
    const mesh = makeDog((R() * 4) | 0); mesh.position.set(x, surfaceHeight(x, z), z); scene.add(mesh); dogs.push({mesh, home: {x: h.x, z: h.z}, state: 'rest', timer: R.range(2, 12), target: null, phase: R() * 6, yaw: R() * TAU});
  }
  const spotOk = (x, z) => field.clearance(x, z) > .3 && !collision.circleHits(x, z, .5) && !W.isWater(x, z);
  function updateDog(d, dt, t, p) {
    const m = d.mesh, ud = m.userData, dx = p.x - m.position.x, dz = p.z - m.position.z, near = Math.hypot(dx, dz);
    if (near > 420) { m.visible = false; return; } m.visible = true; d.timer -= dt;
    if (near < 3.2 && d.state !== 'flee') { d.state = 'flee'; d.target = null; d.timer = 2.2; }
    if (d.timer <= 0) { if (d.state === 'rest') { d.state = 'trot'; d.timer = R.range(3, 7); } else { d.state = 'rest'; d.timer = R.range(5, 16); d.target = null; } }
    let speed = 0;
    if (d.state === 'trot' || d.state === 'flee') {
      if (!d.target || Math.hypot(d.target.x - m.position.x, d.target.z - m.position.z) < .6) { for (let k = 0; k < 8; k++) { const flee = d.state === 'flee', a = flee ? Math.atan2(-dz, -dx) + R.range(-.7, .7) : R() * TAU, r = flee ? R.range(6, 12) : R.range(3, 12), x = (flee ? m.position.x : d.home.x) + Math.cos(a) * r, z = (flee ? m.position.z : d.home.z) + Math.sin(a) * r; if (spotOk(x, z)) { d.target = {x, z}; break; } } }
      if (d.target) { const tx = d.target.x - m.position.x, tz = d.target.z - m.position.z, l = Math.hypot(tx, tz) || 1; speed = d.state === 'flee' ? 3.4 : 1.2; const nx = m.position.x + tx / l * speed * dt, nz = m.position.z + tz / l * speed * dt;
        if (spotOk(nx, nz)) { m.position.x = nx; m.position.z = nz; let da = Math.atan2(-tx, -tz) - d.yaw; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; d.yaw += da * Math.min(1, dt * 6); } else d.target = null; }
    }
    m.position.y = surfaceHeight(m.position.x, m.position.z); m.rotation.y = d.yaw; d.phase += dt * (speed > 0 ? speed * 5.5 : 1);
    const lie = d.state === 'rest' ? 1 : 0; ud.body.position.y = -lie * .14; ud.body.scale.y = 1 - lie * .12;
    ud.legs.forEach((l, i) => { l.rotation.x = lie ? (i < 2 ? -1.2 : 1.2) : Math.sin(d.phase + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI * .5 : 0)) * Math.min(.9, speed * .35); l.position.y = lie ? .2 : .32; });
    ud.tail.rotation.z = Math.sin(t * (lie ? 1.5 : 6) + d.phase) * (lie ? .15 : .5);
  }
  /* ---- birds ---- */
  const wingGeo = (() => { const g = new THREE.BufferGeometry(), v = [0, 0, -.3, 0, 0, .25, -1, .08, .1, 0, 0, -.3, 1, .08, .1, 0, 0, .25, 0, 0, -.3, -.12, .02, .5, 0, 0, .25]; g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g; })();
  const flocks = [], species = [{name: 'crow', color: '#1a1a1c', n: 14, scale: .55, alt: [28, 55], speed: .42, r: [35, 85]}, {name: 'egret', color: '#f2f2ee', n: 14, scale: .8, alt: [14, 34], speed: .3, r: [45, 140]}, {name: 'kite', color: '#6a4a2c', n: 8, scale: 1.1, alt: [70, 130], speed: .16, r: [120, 260]}];
  const centers = {crow: [], egret: [], kite: []};
  for (const b of town.placed.filter(p => p.type === 'shopHouse').filter((_, i) => i % 40 === 0)) centers.crow.push([b.x, b.z]);
  for (const w of W.watercourses) for (let i = 0; i < w.points.length; i += 2) centers.egret.push([w.points[i][0], w.points[i][1]]);
  for (const l of W.lakes) centers.egret.push([l.cx, l.cz]);
  for (const [x, z] of [[-4200, 2500], [-3700, 1700], [-4900, -2600], [-2800, 1400]]) centers.kite.push([x, z]);
  for (const sp of species) {
    const mesh = new THREE.InstancedMesh(wingGeo, new THREE.MeshStandardMaterial({color: sp.color, roughness: .9, side: THREE.DoubleSide}), sp.n); mesh.frustumCulled = false; scene.add(mesh);
    const birds = Array.from({length: sp.n}, () => ({a: R() * TAU, dir: R() < .8 ? 1 : -1, ph: R() * 6, dy: R.range(-4, 4), dr: R.range(.85, 1.15)})), cs = centers[sp.name];
    flocks.push({sp, mesh, birds, center: cs[(R() * cs.length) | 0] || [0, 0], radius: R.range(...sp.r), alt: R.range(...sp.alt)});
  }
  function updateBirds(dt, t, p) {
    for (const f of flocks) {
      const near = Math.hypot(f.center[0] - p.x, f.center[1] - p.z) < 1400; f.mesh.visible = near; if (!near) continue;
      f.birds.forEach((b, i) => {
        b.a += dt * f.sp.speed * b.dir / (f.radius / 60 + .3); const r = f.radius * b.dr, x = f.center[0] + Math.cos(b.a) * r, z = f.center[1] + Math.sin(b.a) * r;
        const y = surfaceHeight(x, z) + f.alt + b.dy + Math.sin(t * .6 + b.ph) * 3, flap = .5 + .5 * Math.abs(Math.sin(t * (f.sp.name === 'kite' ? 2.2 : 9) + b.ph));
        tmp.position.set(x, y, z); tmp.rotation.set(0, -(b.a + Math.PI / 2 * b.dir) + Math.PI / 2, Math.sin(t * .5 + b.ph) * .25); tmp.scale.set(f.sp.scale * (.45 + .55 * flap), f.sp.scale, f.sp.scale); tmp.updateMatrix(); f.mesh.setMatrixAt(i, tmp.matrix);
      });
      f.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  return {dogs, flocks, update(dt, t, p) { for (const d of dogs) updateDog(d, Math.min(dt, .1), t, p); updateBirds(Math.min(dt, .1), t, p); }};
}
