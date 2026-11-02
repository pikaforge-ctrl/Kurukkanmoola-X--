import * as THREE from 'three';
import {Batcher, rgb} from '../kit/batcher.js';
import {Kit} from '../kit/kit.js';
import {mulberry32} from '../kit/util.js';

/**
 * Enterable chaya kada. The interior is a separate "stage" (one room reused by every tea shop) built high above the world at a fixed,
 * in-bounds x/z so the existing player movement, camera obstruction and collision code work unchanged: its walls and furniture are
 * ordinary colliders. Entering teleports the player to the stage with a fade; leaving returns them to the shop door they came through.
 */
export const TEA_MENU = [
  {id: 'milk', name: 'Milk tea (paal chaya)', price: 10, kind: 'drink'}, {id: 'black', name: 'Black tea (kattan chaya)', price: 8, kind: 'drink'}, {id: 'coffee', name: 'Coffee (kaapi)', price: 12, kind: 'drink'},
  {id: 'parippu', name: 'Parippu vada', price: 8, kind: 'snack'}, {id: 'pazham', name: 'Pazham pori', price: 10, kind: 'snack'}, {id: 'uzhunnu', name: 'Uzhunnu vada', price: 8, kind: 'snack'},
];
const ROOM = {w: 7.4, d: 7.0, h: 3.3};
export const STAGE = {x: -5600, z: -3800, y: 2600};

export function createInteriors({scene, assets, createPerson, collision, atmosphere}) {
  const rnd = mulberry32(777), B = new Batcher(2000), K = new Kit(B, assets, rnd), w = B.world('atlas'), conc = K.r('concrete');
  const Y = STAGE.y, X = STAGE.x, Z = STAGE.z;
  const box = (lx, ly, lz, sx, sy, sz, tile, c = [1, 1, 1], faces = 'px nx py pz nz') => { const g = w.at(X + lx, Y, Z + lz, 0); g.box(0, ly, 0, sx, sy, sz, K.r(tile), c, faces); };
  const cyl = (lx, ly, lz, r0, r1, h, tile, c, seg = 8) => { const g = w.at(X + lx, Y, Z + lz, 0); g.cyl(0, ly, 0, r0, r1, h, seg, K.r(tile), c); };
  const solidBox = (lx, lz, sx, sz, h, kind = 'wall') => collision.add({x: X + lx, z: Z + lz, w: sx, d: sz, baseY: Y, height: h, kind});

  /* ---- room shell ---- */
  const hw = ROOM.w / 2, hd = ROOM.d / 2, H = ROOM.h;
  w.at(X, Y, Z, 0).quadGrid([-hw, .01, hd], [hw, .01, hd], [hw, .01, -hd], [-hw, .01, -hd], 3, 3, K.r('tileFloor'), [.95, .9, .85]);
  w.at(X, Y, Z, 0).quadGrid([-hw, H, -hd], [hw, H, -hd], [hw, H, hd], [-hw, H, hd], 3, 3, K.r('woodLight'), [.62, .5, .38]);
  for (let i = -3; i <= 3; i++) box(i * 1.1, H - .1, 0, .16, .2, ROOM.d, 'woodDark', [.7, .55, .42], 'px nx pz nz ny');
  // a wall quad built from p0 to p1 faces the left normal (-dz, dx): choose the direction so it faces INTO the room
  const wallQuad = (p0, p1, y0, y1, tile, c) => w.quadGrid([X + p0[0], Y + y0, Z + p0[1]], [X + p1[0], Y + y0, Z + p1[1]], [X + p1[0], Y + y1, Z + p1[1]], [X + p0[0], Y + y1, Z + p0[1]], Math.max(1, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2.4)), Math.max(1, Math.round((y1 - y0) / 1.6)), K.r(tile), c);
  const cream = [.86, .82, .62], green = [.2, .5, .42];
  for (const [a, b] of [[[-hw, -hd], [hw, -hd]], [[-hw, hd], [-hw, -hd]], [[hw, -hd], [hw, hd]]]) { wallQuad(a, b, 1.15, H, 'wall', cream); wallQuad(a, b, 0, 1.15, 'wallPanel', green); }
  for (const [x0, x1] of [[-hw, -.95], [.95, hw]]) { wallQuad([x1, hd], [x0, hd], 0, 1.15, 'wallPanel', green); wallQuad([x1, hd], [x0, hd], 1.15, H, 'wall', cream); }
  wallQuad([.95, hd], [-.95, hd], 2.4, H, 'wall', cream);
  w.use('sign'); w.quad([X + .95, Y, Z + hd + .02], [X - .95, Y, Z + hd + .02], [X - .95, Y + 2.4, Z + hd + .02], [X + .95, Y + 2.4, Z + hd + .02], K.S.glow, [.95, .98, .9]); w.use('atlas');   // daylight through the doorway
  solidBox(0, -hd - .15, ROOM.w + .6, .3, H); solidBox(-hw - .15, 0, .3, ROOM.d + .6, H); solidBox(hw + .15, 0, .3, ROOM.d + .6, H); solidBox(-(hw + .95) / 2, hd + .15, hw - .95, .3, H); solidBox((hw + .95) / 2, hd + .15, hw - .95, .3, H);
  box(0, H / 2, -hd - .35, ROOM.w + 1, H, .1, 'concrete', [.4, .4, .4], 'pz nz'); box(-hw - .35, H / 2, 0, .1, H, ROOM.d, 'concrete', [.4, .4, .4], 'px nx'); box(hw + .35, H / 2, 0, .1, H, ROOM.d, 'concrete', [.4, .4, .4], 'px nx');

  /* ---- counter, kettle corner, shelves ---- */
  const CY = -hd + 1.55;
  box(-.7, .5, CY, 4.6, 1, .9, 'woodDark', [.8, .65, .5], 'px nx pz nz'); box(-.7, 1.03, CY, 4.8, .07, 1.05, 'stone', [.88, .86, .8], 'px nx py pz nz'); solidBox(-.7, CY, 4.8, 1.05, 1.1, 'prop');
  [[-2.4, [.78, .5, .22]], [-1.75, [.86, .66, .25]], [-1.1, [.65, .42, .2]], [-.45, [.78, .5, .22]]].forEach(([lx, c]) => { cyl(lx, 1.07, CY + .25, .24, .24, .42, 'white', [.85, .93, .94], 10); cyl(lx, 1.2, CY + .25, .2, .2, .16, 'white', c, 8); cyl(lx, 1.5, CY + .25, .26, .24, .06, 'metal', [.6, .6, .62], 10); });
  for (let i = 0; i < 12; i++) cyl(.55 + (i % 6) * .17, 1.07, CY + .2 + Math.floor(i / 6) * .17, .05, .045, .1, 'white', [.88, .96, .96], 6);
  box(1.25, 1.15, CY - .1, .5, .16, .5, 'metal', [.45, .46, .48], 'px nx py pz nz');
  box(1.0, .42, -hd + .6, 1.7, .84, .8, 'brick', [.75, .6, .5], 'px nx py pz'); solidBox(1.0, -hd + .6, 1.7, .8, 1, 'prop');
  cyl(.7, .84, -hd + .6, .3, .26, .45, 'metal', [.62, .64, .66], 12); cyl(1.3, .84, -hd + .6, .28, .25, .4, 'metal', [.55, .58, .6], 12); cyl(1.3, 1.24, -hd + .6, .28, .1, .1, 'metal', [.6, .62, .64], 12);
  box(-.9, .55, -hd + .5, 3.6, 1.1, .5, 'woodDark', [.75, .6, .48], 'pz px nx'); for (let r = 0; r < 3; r++) box(-.9, 1.5 + r * .45, -hd + .3, 3.4, .06, .4, 'woodLight', [.9, .8, .7], 'py pz');
  for (let i = 0; i < 9; i++) for (let r = 0; r < 3; r++) if ((i + r) % 4) cyl(-2.4 + i * .38, 1.53 + r * .45, -hd + .3, .1, .1, .22, 'white', [(i * 37 % 7) / 7 * .5 + .4, .45 + r * .2, .3 + (i % 3) * .2], 8);
  for (let i = 0; i < 4; i++) { const bx = -2.0 + i * 1.1; w.at(X + bx, Y, Z + CY - .3, 0).beam([0, H - .1, 0], [0, H - .55, 0], .02, K.r('woodDark'), [.3, .22, .1]); for (let k = 0; k < 5; k++) cyl(bx + (k - 2) * .05, H - .95 + (k % 2) * .06, CY - .3, .04, .03, .34, 'white', [.92, .78, .2], 5); }   // hanging banana bunches

  /* ---- tables and benches ---- */
  const seats = [];
  for (const [tx, tz] of [[-2.3, .9], [.2, 1.2], [2.4, .7]]) {
    box(tx, .7, tz, 1.2, .06, .7, 'woodLight', [.9, .78, .62], 'px nx py pz nz'); for (const sx of [-.52, .52]) for (const sz of [-.28, .28]) box(tx + sx, .35, tz + sz, .06, .7, .06, 'woodDark', [.7, .55, .4], 'px nx pz nz');
    for (const s of [-1, 1]) { box(tx, .42, tz + s * .62, 1.3, .05, .34, 'woodDark', [.8, .62, .46], 'px nx py pz nz'); for (const sx of [-.55, .55]) box(tx + sx, .2, tz + s * .62, .05, .4, .05, 'woodDark', [.6, .45, .32], 'px nx pz'); seats.push([tx + (s > 0 ? -.3 : .3), tz + s * .62, s]); }
    cyl(tx - .2, .73, tz, .05, .045, .1, 'white', [.88, .96, .96], 6); cyl(tx + .25, .73, tz - .05, .1, .1, .03, 'white', [.95, .9, .8], 8); solidBox(tx, tz, 1.4, 1.5, .8, 'prop');
  }
  const pk = assets.posters.list.filter(p => p.kind !== 'strip'), PW = B.world('poster');
  [[-hw + .02, -.8, 1.7], [-hw + .02, 1.6, 1.5], [hw - .02, -.6, 1.7]].forEach(([lx, lz, y], i) => { const r = assets.posters.rects[pk[(i * 7 + 3) % pk.length].key], s = Math.sign(lx), g = [X + lx, Y + y, Z + lz]; PW.use('poster').quad([g[0], g[1] - .6, g[2] + .4 * s], [g[0], g[1] - .6, g[2] - .4 * s], [g[0], g[1] + .6, g[2] - .4 * s], [g[0], g[1] + .6, g[2] + .4 * s], r, [1, 1, 1]); });
  w.use('sign'); for (const lx of [-1.8, 1.8]) w.at(X + lx, Y, Z + 1.0, 0).box(0, H - .22, 0, .9, .06, .09, K.S.glow, [1, .95, .8], 'px nx pz nz ny'); w.use('atlas');
  const meshes = B.flush(scene, {atlas: assets.materials.atlas, poster: assets.materials.poster, sign: assets.materials.sign});
  for (const m of meshes) { m.castShadow = false; m.visible = false; }

  /* ---- living things: fan, steam, people ---- */
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const setVis = v => { for (const m of meshes) m.visible = v; root.visible = v; };
  const fan = new THREE.Group(); fan.position.set(X + .2, Y + H - .45, Z + .3); root.add(fan);
  const bladeMat = new THREE.MeshStandardMaterial({color: '#cfc9bd', roughness: .7});
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.65, .015, .13), bladeMat); b.position.set(Math.cos(i * 2.094) * .38, 0, Math.sin(i * 2.094) * .38); b.rotation.y = -i * 2.094; fan.add(b); }
  fan.add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .1, 10), bladeMat));
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x2 = cv.getContext('2d'), gr = x2.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64);
  const steamTex = new THREE.CanvasTexture(cv), steams = [];
  for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({map: steamTex, transparent: true, depthWrite: false, opacity: 0})); s.userData = {i, base: i < 6 ? [X + 1.3, Y + 1.4, Z - hd + .6] : [X, Y, Z]}; root.add(s); steams.push(s); }
  const keeper = createPerson('resident', false); keeper.name = 'Chaya Kada Chettan'; keeper.words = 'Chaya? Parippu vada is hot, straight from the oil. Ten rupees for milk tea.'; keeper.role = 'keeper'; keeper.interior = true; root.add(keeper.mesh);
  keeper.mesh.position.set(X - .6, Y, Z + CY - .75); keeper.mesh.rotation.y = Math.PI;
  const guests = []; for (let i = 0; i < 2; i++) { const p = createPerson(i ? 'worker' : 'fisherman', false); p.name = i ? 'Tea drinker' : 'Newspaper reader'; p.words = i ? 'Nothing beats a hot chaya in the rain.' : 'Monsoon is early again, says the paper.'; p.role = 'guest'; const s = seats[i * 2 + 1] || seats[i]; p.mesh.position.set(X + s[0], Y + .445 - .84, Z + s[1]); p.mesh.rotation.y = s[2] > 0 ? 0 : Math.PI; p.legs[0].rotation.x = p.legs[1].rotation.x = -1.45; p.arms[0].rotation.x = -.7; root.add(p.mesh); guests.push(p); }

  const state = {active: false, shop: null, floorY: Y, pour: 0, burst: 0, counter: new THREE.Vector3(X - .6, Y, Z + CY + .95), door: new THREE.Vector3(X, Y, Z + hd - .5), spawn: new THREE.Vector3(X, Y, Z + hd - 1.9)};
  return {
    npcs: [keeper, ...guests], state, root, stage: STAGE, room: ROOM, menu: TEA_MENU,
    get active() { return state.active; }, get floorY() { return state.floorY; },
    nearCounter: p => Math.hypot(p.x - state.counter.x, p.z - state.counter.z) < 1.9, nearDoor: p => Math.hypot(p.x - state.door.x, p.z - state.door.z) < 1.6,
    enter(shop) { state.active = true; state.shop = shop; setVis(true); if (atmosphere) { atmosphere.hold = true; [[-1.8, 1.0], [1.8, 1.0]].forEach(([lx, lz], i) => { const L = atmosphere.lights[i]; L.position.set(X + lx, Y + H - .5, Z + lz); L.intensity = 16; L.distance = 12; }); for (let i = 2; i < atmosphere.lights.length; i++) atmosphere.lights[i].intensity = 0; } },
    exit() { state.active = false; setVis(false); if (atmosphere) { atmosphere.hold = false; atmosphere.lights.forEach(L => { L.distance = 30; }); atmosphere.acc = 1; } },
    flourish(item) { state.pour = 1.4; state.burst = 2.2; state.item = item; },
    update(dt, t) {
      if (!state.active) { for (const s of steams) s.material.opacity = 0; return; }
      fan.rotation.y += dt * 7.5;
      for (const s of steams) {
        const k = (t * .35 + s.userData.i * .13) % 1, base = s.userData.base, big = s.userData.i >= 6, burst = big ? Math.min(1, state.burst) : 1;
        s.position.set(base[0] + Math.sin(t + s.userData.i) * .06, base[1] + k * (big ? 1.4 : 1.0), base[2] + Math.cos(t * .8 + s.userData.i) * .06); s.scale.setScalar(.25 + k * .5); s.material.opacity = (1 - k) * (big ? .5 : .22) * burst;
        if (big) { s.position.x = state.counter.x + .6 + Math.sin(s.userData.i) * .15; s.position.y = state.counter.y + 1.2 + k * 1.1; s.position.z = state.counter.z - .1; }
      }
      state.pour = Math.max(0, state.pour - dt); state.burst = Math.max(0, state.burst - dt);
      keeper.animate(0, t); if (state.pour > 0) { keeper.arms[0].rotation.x = -1.1 - Math.sin(t * 9) * .25; keeper.arms[1].rotation.x = -.8 + Math.sin(t * 9) * .2; } else keeper.arms[0].rotation.x = -.35 - (Math.sin(t * 1.2) * .5 + .5) * .1;
      for (const g of guests) g.arms[0].rotation.x = -.7 + Math.sin(t * .8 + g.mesh.position.x) * .08;
    },
  };
}
