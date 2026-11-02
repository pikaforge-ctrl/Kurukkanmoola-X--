import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {materials as M} from './materials.js';
import {terrainHeight,surfaceHeight,waterInfo,isWater,nearestRoad,forestZone,heights,NX,NZ,TERRAIN_STEP} from './world-layout.js';
const dummy=new THREE.Object3D(),color=new THREE.Color();
const smoothstep=(a,b,v)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);};
const cMud=new THREE.Color('#8d8a6a'),cBed=new THREE.Color('#6d7552'),cLaterite=new THREE.Color('#b0845a'),cRock=new THREE.Color('#8a8579');
// Ground colour per vertex: forest floor, farmland, hill meadow, wet mud on river banks, river-bed, laterite soil patches in town and bare rock on steep slopes.
function terrainTint(x,z,y,slope,n,out){
  const forest=forestZone(x,z);
  out.set(forest?'#6a8a4c':y>440?'#b1b398':z<-1400&&x>-3000&&x<0?'#aec47c':'#98b373');
  const wi=waterInfo(x,z);
  if(wi.distance<0)out.copy(cBed);else if(wi.distance<16)out.lerp(cMud,smoothstep(16,0,wi.distance)*.7);
  if(!forest){const town=Math.max(0,1-Math.hypot(x/1150,z/880));if(town>0)out.lerp(cLaterite,town*(.08+.3*n*n));}
  if(slope>.5)out.lerp(cRock,smoothstep(.5,.95,slope)*.85);
}
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function windMaterial(base,uniform,strength=.12){const material=base.clone();material.onBeforeCompile=shader=>{shader.uniforms.uLandscapeTime=uniform;shader.vertexShader='uniform float uLandscapeTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n#ifdef USE_INSTANCING\nvec4 windPosition=instanceMatrix*vec4(position,1.0);\ntransformed.x += sin(uLandscapeTime*1.6+windPosition.x*.19+windPosition.z*.13)*${strength.toFixed(3)}*pow(max(0.0,position.y),1.3);\n#endif`);};material.customProgramCacheKey=()=>`kx-wind-${strength}`;return material;}
function mountainArea(x,z){
 // Western-Ghats mountain/viewpoint zone. Keep scenic grass and wildlife concentrated here.
 return (x < -3150 && z > 1900) || (x < -2500 && z > 2500 && z < 3900);
}
function instanced(geo,material,points,parent){const mesh=new THREE.InstancedMesh(geo,material,points.length);points.forEach((p,i)=>{dummy.position.set(p[0],p[1],p[2]);dummy.rotation.set(0,p[3]||0,0);dummy.scale.set(p[4]||1,p[5]||p[4]||1,p[6]||p[4]||1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(p[7]){color.set(p[7]);mesh.setColorAt(i,color);}});mesh.computeBoundingSphere();mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function buildLandscape(scene,colliders){
 const time={value:0},terrainMeshes=[],waterMeshes=[],forestMeshes=[],stats={terrainTriangles:0,farTrees:0,nearTrees:0,grassClumps:0,teaBushes:0};
 const groundMaterial=M.grass.clone();groundMaterial.vertexColors=true;groundMaterial.color.set('#c4e1b1');groundMaterial.normalScale.setScalar(.55);groundMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\nvec4 grassA=texture2D(map,vMapUv);vec4 grassB=texture2D(map,vec2(-vMapUv.y,vMapUv.x)*.73+vec2(.43,.21));diffuseColor*=mix(grassA,grassB,.4);\n#endif\ndiffuseColor.rgb *= vec3(.9,1.17,.8);');};
 // World-space UVs keep the photographed grass at metre scale, not 70 m tiles.
 for(const t of [groundMaterial.map,groundMaterial.normalMap,groundMaterial.roughnessMap])if(t){t.repeat.set(1,1);t.needsUpdate=true;}
 for(let iz=0;iz<NZ;iz+=20)for(let ix=0;ix<NX;ix+=20){const sx=Math.min(20,NX-ix),sz=Math.min(20,NZ-iz),pos=[],uv=[],colors=[],indices=[];
  for(let j=0;j<=sz;j++)for(let i=0;i<=sx;i++){const x=-6000+(ix+i)*25,z=-4150+(iz+j)*25,y=heights[(iz+j)*(NX+1)+ix+i];pos.push(x,y,z);uv.push(x/5,z/5);const n=.5+.5*Math.sin(x*.005+Math.cos(z*.009))*Math.cos(z*.006);const bi=(iz+j)*(NX+1)+ix+i,hxp=heights[Math.min(bi+1,heights.length-1)],hxm=heights[Math.max(bi-1,0)],hzp=heights[Math.min(bi+NX+1,heights.length-1)],hzm=heights[Math.max(bi-NX-1,0)],slope=Math.max(Math.abs(hxp-hxm),Math.abs(hzp-hzm))/50;terrainTint(x,z,y,slope,n,color);color.multiplyScalar(.82+n*.27);colors.push(color.r,color.g,color.b);}
  for(let j=0;j<sz;j++)for(let i=0;i<sx;i++){const a=j*(sx+1)+i,b=a+1,c=a+sx+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,groundMaterial);m.receiveShadow=true;m.userData.terrain=true;scene.add(m);terrainMeshes.push(m);stats.terrainTriangles+=indices.length/3;
 }
 const occupied=(x,z,r=1)=>colliders.some(c=>x>c.minX-r&&x<c.maxX+r&&z>c.minZ-r&&z<c.maxZ+r);
 // A spatial index prevents dense instanced foliage from intersecting buildings.
 const cells=new Map();for(const c of colliders){for(let iz=Math.floor((c.minZ-8)/100);iz<=Math.floor((c.maxZ+8)/100);iz++)for(let ix=Math.floor((c.minX-8)/100);ix<=Math.floor((c.maxX+8)/100);ix++){const k=ix+':'+iz;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(c);}}
 function clear(x,z,margin=3){const r=nearestRoad(x,z,true);return !isWater(x,z)&&r.distance>r.road.width/2+margin&&!(cells.get(Math.floor(x/100)+':'+Math.floor(z/100))||[]).some(c=>x>c.minX-margin&&x<c.maxX+margin&&z>c.minZ-margin&&z<c.maxZ+margin);}

 // Tea rows follow the actual hillside at each bush, not a stack of flat boxes.
 const teaGeometry=new THREE.IcosahedronGeometry(1,0),teaPoints=[];const teaRandom=rng(90210);
 for(let patch=0;patch<36;patch++){const cx=-4700+patch%6*270,cz=660+Math.floor(patch/6)*195;for(let row=0;row<18;row++)for(let col=0;col<48;col++){const x=cx+col*2.6,z=cz+row*5+Math.sin(col*.08+patch)*8;if(!clear(x,z,5))continue;teaPoints.push([x,terrainHeight(x,z)+.65,z,teaRandom()*6.28,1.65,.85,1.65,patch%2?'#49642e':'#5d7736']);}}
 const tea=instanced(teaGeometry,new THREE.MeshStandardMaterial({color:'white',roughness:.98}),teaPoints,scene);tea.castShadow=false;stats.teaBushes=teaPoints.length;


 // Low-poly Kerala mountain wildlife, placed as static scenic encounters.
 const animalRoot=new THREE.Group(); scene.add(animalRoot);
 const animalMat={
   dark:new THREE.MeshStandardMaterial({color:'#43372b',roughness:.95}),
   brown:new THREE.MeshStandardMaterial({color:'#7a593b',roughness:.95}),
   tan:new THREE.MeshStandardMaterial({color:'#b18a5e',roughness:.95}),
   grey:new THREE.MeshStandardMaterial({color:'#77736a',roughness:.98}),
   black:new THREE.MeshStandardMaterial({color:'#26251f',roughness:.98}),
   white:new THREE.MeshStandardMaterial({color:'#d8d0bf',roughness:.95})
 };
 function primitiveAnimal(kind,x,z,scale=1,rot=0){
   const g=new THREE.Group();
   g.position.set(x,terrainHeight(x,z),z); g.rotation.y=rot; g.scale.setScalar(scale); animalRoot.add(g);
   const body=(m,sx,sy,sz,px,py,pz)=>{const q=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);q.position.set(px,py,pz);g.add(q);return q;};
   const sph=(m,sx,sy,sz,px,py,pz)=>{const q=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),m);q.scale.set(sx,sy,sz);q.position.set(px,py,pz);g.add(q);return q;};
   const leg=(m,px,pz,h)=>{const q=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,h,6),m);q.position.set(px,h/2,pz);g.add(q);};
   const horn=(px,pz,lean)=>{const q=new THREE.Mesh(new THREE.ConeGeometry(.055,.48,6),animalMat.white);q.position.set(px,1.42,pz);q.rotation.z=lean;q.rotation.x=.1;g.add(q);};

   if(kind==='Nilgiri Tahr'){
     sph(animalMat.tan,.52,.38,.9,0,1.0,0); sph(animalMat.tan,.34,.34,.38,0,1.38,-.52);
     for(const [px,pz] of [[-.27,-.3],[.27,-.3],[-.27,.3],[.27,.3]]) leg(animalMat.dark,px,pz,.72);
     horn(-.16,-.67,-.22); horn(.16,-.67,.22);
   } else if(kind==='Sambar Deer'){
     sph(animalMat.brown,.62,.48,1.0,0,1.05,0); sph(animalMat.brown,.34,.32,.55,0,1.45,-.65);
     for(const [px,pz] of [[-.3,-.35],[.3,-.35],[-.3,.35],[.3,.35]]) leg(animalMat.dark,px,pz,.9);
     horn(-.18,-.88,-.16); horn(.18,-.88,.16);
   } else if(kind==='Gaur'){
     sph(animalMat.dark,.85,.7,1.25,0,1.15,0); sph(animalMat.dark,.46,.45,.55,0,1.52,-.83);
     for(const [px,pz] of [[-.45,-.42],[.45,-.42],[-.45,.42],[.45,.42]]) leg(animalMat.dark,px,pz,1.05);
     horn(-.24,-1.05,-.18); horn(.24,-1.05,.18);
     body(animalMat.white,.08,.45,.75,-.44,1.15,-.02); body(animalMat.white,.08,.45,.75,.44,1.15,-.02);
   } else if(kind==='Asian Elephant'){
     sph(animalMat.grey,1.0,.82,1.55,0,1.25,0); sph(animalMat.grey,.65,.65,.72,0,1.65,-1.05);
     for(const [px,pz] of [[-.6,-.58],[.6,-.58],[-.6,.58],[.6,.58]]) leg(animalMat.grey,px,pz,1.25);
     const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,.9,8),animalMat.grey);
     trunk.position.set(0,1.18,-1.48); trunk.rotation.x=-.35; g.add(trunk);
     sph(animalMat.grey,.16,.16,.08,-.47,1.75,-1.35); sph(animalMat.grey,.16,.16,.08,.47,1.75,-1.35);
   } else if(kind==='Leopard'){
     sph(animalMat.tan,.55,.38,1.05,0,.9,0); sph(animalMat.tan,.34,.32,.4,0,1.18,-.62);
     for(const [px,pz] of [[-.28,-.35],[.28,-.35],[-.28,.35],[.28,.35]]) leg(animalMat.tan,px,pz,.65);
     for(const [sx,sz] of [[-.12,-.72],[.12,-.72],[-.12,-.54],[.12,-.54]]) sph(animalMat.black,.035,.035,.035,sx,1.24,sz);
     const tail=new THREE.Mesh(new THREE.CylinderGeometry(.035,.07,.8,6),animalMat.tan);tail.position.set(.45,.9,.7);tail.rotation.x=1.0;tail.rotation.z=.3;g.add(tail);
   }
   g.userData.animalKind=kind;
   return g;
 }
 const wildlife=[
   ['Nilgiri Tahr',-4570,2940,.9,.25],
   ['Sambar Deer',-4310,3210,1.0,-.35],
   ['Gaur',-3880,2940,1.15,.55],
   ['Asian Elephant',-3500,2750,1.0,-.6],
   ['Leopard',-4040,3480,.85,.15],
   ['Sambar Deer',-4690,3320,.9,.8]
 ];
 wildlife.forEach(a=>primitiveAnimal(...a));

 function update(t,p,quality){time.value=t;}
 return {terrainMeshes,waterMeshes,simpleWater:null,update,stats,clear};
}
