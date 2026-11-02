import * as THREE from 'three';

/**
 * Hill-station mist.
 * three.js applies fog from one shader chunk shared by every built-in material, so patching those chunks gives the terrain,
 * buildings, trees, water and vehicles consistent mist without touching any material. The mist term depends on the average height of
 * camera and fragment: it forms on the high slopes (and when you are up there), grows denser with elevation, drifts with slow noise and
 * fades with distance. The lowlands and town keep a clear view. The uniform is a shared Float32Array (three.js clones uniform values per
 * program except typed arrays), so one write per frame updates every material.
 */
export const mist = new Float32Array([0, 1, 255, 640]);   // x: time, y: strength, z: start elevation, w: full elevation
let patched = false;
export function patchFogChunks() {
  if (patched) return; patched = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth;
varying vec3 vKxW;
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z;
vKxW = transpose( mat3( viewMatrix ) ) * mvPosition.xyz + cameraPosition;
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor;
varying float vFogDepth;
varying vec3 vKxW;
uniform vec4 kxMist;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear;
uniform float fogFar;
#endif
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
#ifdef FOG_EXP2
float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
#else
float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
#endif
float kxH = 0.5 * ( vKxW.y + cameraPosition.y );
float kxBand = smoothstep( kxMist.z, kxMist.w, kxH );
float kxN = 0.5 + 0.25 * sin( vKxW.x * 0.0021 + kxMist.x * 0.012 ) + 0.25 * sin( vKxW.z * 0.0017 - kxMist.x * 0.009 + vKxW.x * 0.0007 );
float kxMistK = 1.0 - exp( - kxMist.y * kxBand * ( 0.0005 + 0.0007 * kxN ) * vFogDepth );
float kxDay = clamp( dot( fogColor, vec3( 0.33 ) ) * 2.2, 0.0, 1.0 );
vec3 kxCol = mix( fogColor, vec3( 0.92, 0.95, 0.96 ) * kxDay, 0.3 );
gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, kxCol, kxMistK ), 1.0 - ( 1.0 - fogFactor ) * ( 1.0 - kxMistK ) );
#endif`;
  for (const k of ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon', 'matcap', 'points', 'dashed', 'sprite', 'distanceRGBA']) if (THREE.ShaderLib[k]) THREE.ShaderLib[k].uniforms.kxMist = {value: mist};
}
const smooth01 = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Atmosphere {
  constructor(scene, lamps) {
    patchFogChunks();
    this.scene = scene; this.lamps = lamps; this.acc = 1; this.night = 0; this.hold = false;
    this.lights = Array.from({length: 8}, () => { const l = new THREE.PointLight('#ffd49a', 0, 30, 2); l.castShadow = false; scene.add(l); return l; });
  }
  /** t: elapsed seconds; day: 0..1 sun height; weather: 'sun'|'cloud'|'rain'|'night' */
  update(dt, t, pos, day, weather) {
    mist[0] = t; mist[1] = weather === 'rain' ? 1.6 : weather === 'cloud' ? 1.25 : 1;
    this.night = 1 - smooth01(0.02, 0.28, day);
    if (this.hold) return;   // an interior owns the pooled lights while it is active
    this.acc += dt; if (this.acc < .25) return; this.acc = 0;
    const near = []; for (const l of this.lamps) { const d = (l.x - pos.x) ** 2 + (l.z - pos.z) ** 2; if (d < 12000) near.push([d, l]); }
    near.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.lights.length; i++) { const L = this.lights[i], n = near[i]; if (n) { L.position.set(n[1].x, n[1].y - .3, n[1].z); L.intensity = this.night * 38; } else L.intensity = 0; }
  }
}
