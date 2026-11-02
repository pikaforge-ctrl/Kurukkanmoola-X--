import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {materials as M,mat,mesh,box,cylinder,sphere,beam,sign,roof,random,range} from './materials.js';
import {createVehicle,createPerson,createBoat,vehicleTypes} from './entities.js';
import {buildLandscape} from './landscape.js';
import {WORLD_WIDTH,WORLD_HEIGHT,WORLD_BOUNDS,PLAYER_SPAWN,landmarks,roads,roadChains,townKeepClear,nearestRoad,isWater,terrainHeight,surfaceHeight,waterLevelAt,waterInfo,islands,watercourses,lakes,forestZone} from './world-layout.js';
import {mulberry32} from './kit/util.js';
import {Batcher} from './kit/batcher.js';
import {Kit} from './kit/kit.js';
import {createBuildings} from './kit/buildings.js';
import {Vegetation} from './kit/vegetation.js';
import {CollisionWorld} from './systems/collision.js';
import {buildRoadGraph} from './systems/road-graph.js';
import {RoadField} from './systems/road-field.js';
import {buildRoads} from './systems/roads-core.js';
import {buildRoadside} from './systems/roadside.js';
import {buildTown} from './systems/town.js';
import {populateVegetation} from './systems/veg-place.js';
import {WaterSystem} from './systems/water.js';
import {Atmosphere} from './systems/atmosphere.js';
import {createTraffic} from './systems/traffic.js';
import {createNpcLife} from './systems/npc-life.js';
import {createInteriors} from './systems/interiors.js';
import {createFauna} from './systems/fauna.js';
export * from './world-layout.js';

/**
 * createWorld(scene, {assets, renderer}). Everything static (roads, buildings, signs, poles, walls) is authored through the Batcher
 * and flushed into a few hundred meshes; vegetation is instanced; water is a flow-map shader; traffic, people, wildlife and the tea
 * shop interior are separate systems under src/systems. Legacy landmarks (memorial, dam, viewpoints, jetties, paddies) are unchanged.
 */
export function createWorld(scene,{assets,renderer}={}){
  const T0=performance.now(),timing={},lap=k=>{timing[k]=Math.round(performance.now()-T0);};
  const staticRoot=new THREE.Group();scene.add(staticRoot);
  const structures=[],boats=[],npcs=[],parked=[],traffic=[],roadMaterials=[M.road],lamps=[],counts={};
  const collision=new CollisionWorld(32),colliders=collision.all;
  const collider=(x,z,w,d)=>collision.add({x,z,w,d,baseY:terrainHeight(x,z),height:30,kind:'building'});
  const B=new Batcher(320),K=new Kit(B,assets,mulberry32(5150)),bk=createBuildings(K);
  const W={terrainHeight,isWater,waterInfo,nearestRoad,PLAYER_SPAWN,townKeepClear,forestZone,lakes,watercourses};

  /* ---- roads, roadside furniture, town ---- */
  const graph=buildRoadGraph(roadChains),hub=graph.nodes.find(n=>Math.hypot(n.x,n.z)<2);
  const field=new RoadField(roads,{minX:-6150,maxX:6150,minZ:-4300,maxZ:4300});lap('graph');
  const roadVis=buildRoads({B,K,graph,hub});lap('roads');
  const roadside=buildRoadside({B,K,graph,roads:roadVis,buildings:bk,collision,M,field});lap('roadside');
  const town=buildTown({B,K,bk,graph,roads:roadVis,roadside,collision,field,assets,W});lap('town');
  const {PLAN,placeNear}=town;

  /* ---- legacy landmarks kept as they were ---- */
 // Central memorial inspired by the supplied second reference image.
 // It is a generic heroic bronze monument rather than a likeness reproduction.
 function heroStatue(x,z){
   const g=new THREE.Group();
   const baseY=terrainHeight(x,z);
   g.position.set(x,baseY,z);
   staticRoot.add(g);
   const bronze=mat('#6f5135',.5,.72);
   const darkBronze=mat('#3f2d20',.62,.7);
   const stoneMat=mat('#4e514d',.95,.05);
   box(g,18,1.2,14,0,.6,0,stoneMat);
   box(g,13,.9,10,0,1.65,0,mat('#6a6d67',.82,.08));
   box(g,10,.65,7,0,2.42,0,darkBronze);
   cylinder(g,1.35,1.55,7,-2.2,5.95,0,bronze,10).rotation.z=-.07;
   cylinder(g,1.35,1.55,7,2.2,5.95,0,bronze,10).rotation.z=.07;
   box(g,2.3,.8,3.2,-2.5,2.0,0,darkBronze);
   box(g,2.3,.8,3.2,2.5,2.0,0,darkBronze);
   const torso=mesh(new THREE.CylinderGeometry(2.8,3.8,6.2,12),bronze,g,0,11.1,0);torso.scale.z=.72;
   sphere(g,0,15.4,0,2.0,2.2,1.7,bronze);
   for(let i=0;i<7;i++)sphere(g,-1.5+i*.5,17.15,(i%2?.45:-.1),.55,.65,.55,darkBronze);
   beam(g,[-3.2,13.0,0],[-5.3,8.7,0],.75,bronze);
   beam(g,[3.2,13.0,0],[5.3,8.7,0],.75,bronze);
   sphere(g,-5.3,8.3,0,.95,1.05,.95,bronze);
   sphere(g,5.3,8.3,0,.95,1.05,.95,bronze);
   const capeMat=mat('#3b3129',.88,.2);
   const cape=new THREE.Mesh(new THREE.PlaneGeometry(7.8,5.6,1,1),capeMat);
   cape.position.set(0,12.4,-2.3); cape.rotation.x=-.18; cape.rotation.y=Math.PI; cape.scale.x=1.1; g.add(cape);
   for(let i=0;i<3;i++){const fold=box(g,.22,4.9,.55,-2.5+i*2.4,11.5,-2.55,capeMat);fold.rotation.z=(i-1)*.06;}
   sign(g,'MINNAL MURALI\nMEMORIAL',8.6,.75,0,2.85,6.15,'#3d2b20','#efe4cf');
   collider(x,z,20,16);
   structures.push({mesh:g,type:'monument',name:'Minnal Murali Memorial',x,z,w:20,d:16,height:18});
   return g;
 }
 heroStatue(78,520);
 function stripMesh(pos,uv,material){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.receiveShadow=true;scene.add(m);return m;}
 function jetty(x,z,rot=0){const g=new THREE.Group();g.position.set(x,waterLevelAt(x,z)+.02,z);g.rotation.y=rot;staticRoot.add(g);box(g,8,.25,28,0,.1,0,M.wood);for(let zz=-12;zz<=12;zz+=4)for(const side of [-1,1])cylinder(g,.11,.14,2.2,side*3.2,1.1,zz,M.wood,8);sign(g,'JETTY',3.2,.5,0,1.8,-12.8,'#1f5149','#f2e6c9');}
  const hillTea=(x,z)=>placeNear('teaShop',PLAN.teaShop(),x,z,{search:40,step:8,o:{opts:{signName:'Hill View Chaya'}}});
 {const g=new THREE.Group();g.position.set(1030,terrainHeight(1030,80)+.12,80);staticRoot.add(g);box(g,65,.15,105,0,0,0,M.leafLight);for(const x of [-31,31])box(g,.12,.025,100,x,.1,0,M.mark);for(const z of [-50,0,50])box(g,62,.025,.12,0,.1,z,M.mark);}
 function viewpoint(x,z,name){
   const g=new THREE.Group();g.position.set(x,surfaceHeight(x,z)+.2,z);staticRoot.add(g);
   box(g,22,.4,14,0,0,10,M.wood);
   for(const side of [-1,1]){beam(g,[side*10,1.3,4],[side*10,1.3,16],.07,M.wood);for(let zz=4;zz<=16;zz+=3)cylinder(g,.09,.09,1.5,side*10,.6,zz,M.wood,6);}
   beam(g,[-10,1.3,16],[10,1.3,16],.07,M.wood);
   for(const xx of [-6,6]){box(g,3,.18,.65,xx,.65,10,M.wood);box(g,3,.8,.12,xx,1.1,10.3,M.wood);}
   // Extra benches for the mountain lookout.
   for(const [bx,bz] of [[-5,7],[5,7],[0,13]]){
     box(g,3.8,.18,.55,bx,.85,bz,M.wood);
     for(const lx of [-1.5,1.5]) cylinder(g,.08,.08,.8,bx+lx,.45,bz,M.wood,6);
   }
   sign(g,name,10,.7,0,2,16.1);
   hillTea(x+30,z+25);

   // Full timber watch tower at the Churuli mountain viewpoint.
   if(name==='CHURULI VIEW POINT'){
     const t=new THREE.Group();t.position.set(x+12,surfaceHeight(x+12,z+7)+.2,z+7);staticRoot.add(t);
     const towerWood=mat('#5a3d28',.92,.72);
     const towerRoof=mat('#6d4a2e',.95,.7);
     for(const [tx,tz] of [[-3,-3],[3,-3],[-3,3],[3,3]]){cylinder(t,.18,.24,7,tx,3.5,tz,towerWood,8);}
     box(t,7.2,.28,7.2,0,7.05,0,M.wood);
     for(const side of [-1,1]){
       box(t,.12,2.4,7,side*3.45,8.0,0,towerWood);
       box(t,7,2.4,.12,0,8.0,side*3.45,towerWood);
     }
     box(t,7.7,.22,7.7,0,9.45,0,towerRoof);
     roof(t,8.2,8.2,10.1,0,0);
     // Simple ladder/stair to the viewing deck.
     for(let i=0;i<12;i++) box(t,2.0,.14,.42,0,1.0+i*.5,-3.9+i*.42,M.wood);
     sign(t,'MOUNTAIN WATCH TOWER',5.8,.48,0,7.7,3.56,'#3f2a1d','#f3dfb5');
   }
 }
 viewpoint(800,-1900,'SUNSET VIEW POINT');viewpoint(-4400,2850,'CHURULI VIEW POINT');viewpoint(-4890,-2900,'KURINJI FALLS');
 {const g=new THREE.Group();g.position.set(1600,80,2240);staticRoot.add(g);box(g,650,44.7,24,0,22.35,0,M.stone);for(let x=-260;x<=260;x+=65){box(g,10,38,30,x,19,0,M.plaster);box(g,42,18,.5,x+24,28,-12.5,M.steel);}for(const side of [-1,1])box(g,650,1.1,.4,0,45.5,side*12,M.white);box(g,24,7,15,-260,49,25,M.plaster);sign(g,'KANNADIKAL DAM',28,1.6,0,39,-12.6).rotation.y=Math.PI;}
 const cropMat=mat('#879844'),paddyPos=[],paddyUv=[];for(let patch=0;patch<35;patch++){const cx=-2800+(patch%7)*300,cz=-2550+Math.floor(patch/7)*310;for(let row=0;row<20;row++){const z=cz+row*5;for(let col=0;col<30;col++){const x=cx+col*4;if(isWater(x,z)||nearestRoad(x,z,true).distance<12)continue;for(const [dx,dz] of [[0,0],[0,3],[4,0],[4,0],[0,3],[4,3]]){paddyPos.push(x+dx,terrainHeight(x+dx,z+dz)+.25,z+dz);paddyUv.push(dx/4,dz/3);}}}}stripMesh(paddyPos,paddyUv,cropMat);
 const jettyPoints=[[2820,-1660],[3670,-2070],[4450,-2250],[3000,-2890],[5140,-2760],[2450,-2110],[5200,-550],[2050,-3480]];
 jettyPoints.forEach(([x,z],i)=>{jetty(x,z,i%2?Math.PI/2:0);const b=createBoat();b.position.set(x+18,waterLevelAt(x,z)+.3,z+22);b.rotation.y=i*.8;scene.add(b);boats.push({mesh:b,x:x+18,z:z+22,baseY:b.position.y});});
 let busDistance=0;for(const r of roads){if(!['Mountain Road','Dam Road','South Backwater Road'].includes(r.name))continue;busDistance+=Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1]);if(busDistance<550)continue;busDistance=0;const x=r.b[0]+r.width/2+4,z=r.b[1];if(isWater(x,z))continue;const g=new THREE.Group();g.position.set(x,terrainHeight(x,z),z);staticRoot.add(g);box(g,5,.15,2.6,0,2.8,0,M.roof);for(const side of [-1,1])cylinder(g,.065,.065,2.8,side*2.1,1.4,0,M.steel,6);box(g,3.5,.2,.5,0,.65,0,M.wood);sign(g,'KSRTC • BUS STOP',4.7,.45,0,2.45,1.3);}

  /* ---- regional buildings placed with the same footprint validation as the town ---- */
  const cluster=(count,type,plan,zone,o={})=>{let done=0;for(let n=0;n<count*30&&done<count;n++){const [x,z]=zone(),rec=placeNear(type,plan(),x,z,{search:40,step:10,o});if(rec)done++;}counts[type+'Regional']=(counts[type+'Regional']||0)+done;};
  cluster(40,'workshop',PLAN.workshop,()=>[range(1250,2300),range(300,1250)],{opts:{sign:'workshop'}});
  cluster(24,'villa',PLAN.villa,()=>random()<.5?[range(-4400,-3400),range(2100,2850)]:[range(2000,5600),range(-1500,-450)]);
  cluster(9,'institution',()=>PLAN.institution(7),()=>[range(-2000,2000),range(-1500,1500)],{opts:{sign:'school',floors:2,bays:7}});
  cluster(26,'hut',PLAN.hut,()=>[range(-4500,-3200),range(-1800,-800)]);
  for(const [x,z] of [[-4180,2310],[-3630,2600],[-4070,2780],[-3650,2280]])placeNear('hotel',PLAN.hotel(),x,z,{search:90,o:{opts:{sign:'resort',floors:2,bays:5,depth:13}}});
  placeNear('institution',PLAN.institution(8),-3770,1060,{search:80,o:{opts:{sign:'teafactory',floors:2,bays:8,depth:13}}});placeNear('workshop',PLAN.workshop(),-3710,1030,{search:60});
  for(let i=0;i<12;i++)placeNear('traditionalHouse',PLAN.traditionalHouse(),-3850+i%4*28,940+Math.floor(i/4)*35,{search:40,step:8});
  for(const i of islands)for(let n=0;n<6;n++)placeNear('hut',PLAN.hut(),i.x+Math.cos(n)*65,i.z+Math.sin(n)*65,{search:30,step:8,o:{valid:{water:-1e9}}});
  lap('regional');

  /* ---- vegetation (instanced) and water ---- */
  const veg=new Vegetation(scene,assets);
  const vegStats=populateVegetation({veg,town,roads:roadVis,roadside,collision,field,W});lap('vegPlace');
  const waterSys=new WaterSystem(scene,assets,W);waterSys.buildBodies();lap('water');
  waterSys.dressFalls(veg);const streamStats=waterSys.buildStreams({field,veg});veg.build();lap('vegetation');

  /* ---- parked vehicles: a paved yard with every vehicle type, the stand's taxis and buses, and the player's car ---- */
  const yard=(()=>{const hw=46,hd=15;for(let r=0;r<=300;r+=18)for(let a=0;a<(r?12:1);a++){const ang=a/12*Math.PI*2+r*.3,cx=130+Math.cos(ang)*r,cz=-40+Math.sin(ang)*r*.8;if(town.validFootprint(cx,cz,hw,hd,0,{roadMargin:2.5,slope:2.2,margin:.5}))return {cx,cz,hw,hd};}return null;})();
  if(yard){const Wr=B.world('atlas'),st=6,nx=Math.round(yard.hw*2/st),nz=Math.round(yard.hd*2/st);
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x0=yard.cx-yard.hw+i*st,z0=yard.cz-yard.hd+j*st,y=(a,b)=>terrainHeight(a,b)+.1;Wr.use('atlas').quad([x0,y(x0,z0+st),z0+st],[x0+st,y(x0+st,z0+st),z0+st],[x0+st,y(x0+st,z0),z0],[x0,y(x0,z0),z0],K.r('concrete'),[.55,.57,.6]);}
    collision.add({x:yard.cx,z:yard.cz-yard.hd-.4,w:yard.hw*2,d:.5,baseY:terrainHeight(yard.cx,yard.cz),height:1.2,kind:'wall'});}
  vehicleTypes.forEach((spec,i)=>{const v=createVehicle(spec.id);let vx,vz;if(yard){vx=yard.cx-yard.hw+4+(i%13)*6.6;vz=yard.cz+(i<13?-6.5:6.5);}else{vx=60+(i%8)*16;vz=-35+Math.floor(i/8)*18;}v.mesh.position.set(vx,surfaceHeight(vx,vz),vz);v.mesh.rotation.y=i<13?0:Math.PI;scene.add(v.mesh);parked.push(v);});
  for(const sp of town.parkedSpots){const v=createVehicle(sp.kind);v.mesh.position.set(sp.x,surfaceHeight(sp.x,sp.z),sp.z);v.mesh.rotation.y=sp.yaw+Math.PI;scene.add(v.mesh);parked.push(v);}
  const spawnCar=createVehicle('hatch'),carX=PLAYER_SPAWN.x+16,carZ=PLAYER_SPAWN.z-4;
  spawnCar.mesh.position.set(carX,surfaceHeight(carX,carZ),carZ);spawnCar.mesh.rotation.y=Math.PI/2;scene.add(spawnCar.mesh);parked.push(spawnCar);

  /* ---- traffic, people, tea shop interior, wildlife ---- */
  const trafficSys=createTraffic({scene,graph,hub,createVehicle,surfaceHeight,size:44,collision});for(const v of trafficSys.vehicles)traffic.push(v);
  const atmosphere=new Atmosphere(scene,roadside.lamps);
  const extra=[];
  {const hc=roadVis.crossings.filter(c=>Math.hypot(c.x,c.z)<90).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];if(hc)extra.push({role:'police',x:hc.x+hc.tz*(hc.width/2+1.8),z:hc.z-hc.tx*(hc.width/2+1.8),yaw:Math.atan2(-hc.tz,hc.tx)});}
  for(const r of town.placed.filter(p=>p.type==='temple'))extra.push({role:'priest',x:r.door.x+Math.sin(r.rot)*2.5,z:r.door.z+Math.cos(r.rot)*2.5,yaw:r.rot});
  for(const r of [town.landmarkRecs.college,town.landmarkRecs.science])if(r){extra.push({role:'student',x:r.door.x+Math.sin(r.rot)*3,z:r.door.z+Math.cos(r.rot)*3,yaw:r.rot+Math.PI});extra.push({role:'doctor',x:r.door.x+Math.sin(r.rot)*4+2,z:r.door.z+Math.cos(r.rot)*4,yaw:r.rot});}
  for(const [x,z] of jettyPoints)extra.push({role:'fisherman',x:x+3,z:z+3.5});
  if(town.bus)extra.push({role:'driver',x:town.bus.door.x,z:town.bus.door.z,yaw:town.bus.rot});
  const npcLife=createNpcLife({scene,createPerson,graph,edgeData:roadVis.edgeData,crossings:roadVis.crossings,busStops:roadside.busStops,town,collision,field,surfaceHeight,trafficVehicles:trafficSys.vehicles,hub,extraSpots:extra,npcs});lap('npcs');
  const interiors=createInteriors({scene,assets,createPerson,collision,atmosphere});for(const n of interiors.npcs)npcs.push(n);
  const fauna=createFauna({scene,surfaceHeight,collision,field,town,roadside,W:{isWater,watercourses,lakes}});lap('fauna');
 const markers=landmarks.map(l=>{const g=new THREE.Group();g.position.set(l.x,surfaceHeight(l.x,l.z)+.14,l.z);scene.add(g);const ring=mesh(new THREE.RingGeometry(5,5.4,48),new THREE.MeshBasicMaterial({color:'#e9cb8a',transparent:true,opacity:.7,side:THREE.DoubleSide}),g);ring.rotation.x=-Math.PI/2;return g;});

  const landscape=buildLandscape(scene,colliders);lap('landscape');

  /* ---- flush the batched kit geometry into meshes with their materials ---- */
  const asphalt=M.road.clone();for(const f of ['map','normalMap','roughnessMap'])if(asphalt[f]){asphalt[f]=asphalt[f].clone();asphalt[f].repeat.set(1,1);}
  asphalt.vertexColors=true;asphalt.side=THREE.DoubleSide;roadMaterials.push(asphalt);
  const padMat=asphalt.clone();padMat.polygonOffset=true;padMat.polygonOffsetFactor=-1;padMat.polygonOffsetUnits=-1;roadMaterials.push(padMat);
  const shoulderMat=M.soil.clone();shoulderMat.vertexColors=true;shoulderMat.side=THREE.DoubleSide;
  const markMat=new THREE.MeshStandardMaterial({map:assets.wear,vertexColors:true,alphaTest:.35,roughness:.85,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const am=assets.materials,kitMeshes=B.flush(scene,{road:asphalt,roadPad:padMat,shoulder:shoulderMat,mark:markMat,atlas:am.atlas,atlasS:am.atlas,roof:am.roof,sign:am.sign,poster:am.poster,billboard:am.billboard,roadSign:am.roadSign},{shadowKeys:['atlas','roof']});
  roadside.finishWires();for(const w of roadside.wireMeshes)scene.add(w);lap('flush');
 // Batch static architecture by material and spatial cell; far architecture is culled.
 staticRoot.updateMatrixWorld(true);const buckets=new Map();staticRoot.traverse(o=>{if(!o.isMesh)return;const p=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),key=o.material.uuid+':'+Math.floor(p.x/320)+':'+Math.floor(p.z/320);let b=buckets.get(key);if(!b){b={material:o.material,geometries:[],cast:false,x:p.x,z:p.z};buckets.set(key,b);}let geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);for(const k of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(k))geo.deleteAttribute(k);if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));b.geometries.push(geo);b.cast ||= o.castShadow;});
 const staticMeshes=[];for(const b of buckets.values()){const geometry=mergeGeometries(b.geometries,false);if(!geometry)continue;const m=new THREE.Mesh(geometry,b.material);m.castShadow=b.cast;m.receiveShadow=true;m.userData.center={x:b.x,z:b.z};scene.add(m);staticMeshes.push(m);b.geometries.forEach(g=>g.dispose());}scene.remove(staticRoot);
 // Cache a north-up map from exactly the same water, heights, roads and structures.
 // Cache a north-up map from exactly the same water, heights, roads and structures.
 const mapCanvas=document.createElement('canvas');mapCanvas.width=720;mapCanvas.height=498;const mc=mapCanvas.getContext('2d'),pixels=mc.createImageData(720,498);for(let y=0;y<498;y++)for(let x=0;x<720;x++){const wx=x/720*12000-6000,wz=4150-y/498*8300,h=terrainHeight(wx,wz),wet=isWater(wx,wz),shade=Math.max(.65,Math.min(1.3,1+(terrainHeight(wx-25,wz+25)-h)*.015)),i=(y*720+x)*4;const rgb=wet?[52,112,122]:h>230?[91,110,65]:[75,101,64];pixels.data[i]=rgb[0]*shade;pixels.data[i+1]=rgb[1]*shade;pixels.data[i+2]=rgb[2]*shade;pixels.data[i+3]=255;}mc.putImageData(pixels,0,0);const mapPoint=(x,z)=>[(x+6000)/12000*720,(4150-z)/8300*498];for(const r of roads){mc.strokeStyle=r.type==='highway'?'#ead3a0':r.type==='hill'?'#e3c381':'#c3bb96';mc.lineWidth=r.width>=8?1.25:.65;mc.beginPath();mc.moveTo(...mapPoint(...r.a));mc.lineTo(...mapPoint(...r.b));mc.stroke();}mc.fillStyle='#d6c6ac';for(const b of colliders.filter(c=>c.kind==='building')){const [x,y]=mapPoint(b.minX,b.maxZ);mc.fillRect(x,y,Math.max(.8,(b.maxX-b.minX)*.06),Math.max(.8,(b.maxZ-b.minZ)*.06));}
  const CULL={atlas:1900,atlasS:520,roof:1900,sign:900,poster:240,billboard:1200,roadSign:450,road:2600,roadPad:1300,shoulder:2000,mark:380};
  let lastT=0;
  function setNight(v){am.atlas.emissiveIntensity=v*1.0;am.sign.emissiveIntensity=v*.9;am.billboard.emissiveIntensity=v*.55;}
  function update(t,p,q){
    const fdt=Math.min(.1,Math.max(0,t-lastT));lastT=t;fauna.update(fdt,t,p);landscape.update(t,p,q);waterSys.update(t,p,q);veg.time.value=t;veg.update(p.x,p.z,q);
    const k=q==='high'?1.25:q==='low'?.45:.72;
    for(const m of kitMeshes){const c=m.userData.center,d=Math.hypot(c.x-p.x,c.z-p.z);m.visible=d<CULL[m.userData.key]*k+260;m.castShadow=m.userData.canCast&&d<170;}
    for(const w of roadside.wireMeshes)w.visible=Math.hypot(w.userData.center.x-p.x,w.userData.center.z-p.z)<(600*k+200);
    for(const m of staticMeshes){const d=Math.hypot(m.userData.center.x-p.x,m.userData.center.z-p.z);m.visible=d<(q==='high'?5000:q==='low'?1800:3200);m.castShadow=d<170;}
    for(const v of parked)v.mesh.visible=v.mesh.position.distanceTo(p)<(q==='low'?450:1000);
    for(const n of npcs)n.mesh.visible=n.mesh.position.distanceTo(p)<450;
  }
  Object.assign(counts,{buildings:town.placed.length,teaShops:town.teaShops.length,colliders:collision.all.length,vegetation:veg.count,kitTriangles:Math.round(kitMeshes.reduce((s,m)=>s+m.geometry.index.count/3,0)),kitMeshes:kitMeshes.length,streams:streamStats.streams,waterTriangles:waterSys.stats.water,timing,townStats:town.stats,vegStats});
  lap('done');
  return {...landscape,update,mapCanvas,counts,bridges:roadVis.bridgeDecks.length,colliders,structures,staticMeshes,roadMaterials,lamps,parked,traffic,npcs,boats,markers,roads,landmarks,
    jobSites:town.jobSites,teaShops:town.teaShops,collision,trafficSys,npcLife,interiors,fauna,atmosphere,waterSys,veg,town,setNight};
}
