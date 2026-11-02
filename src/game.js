import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createWorld,landmarks,roads,nearestRoad,isWater,riverX,terrainHeight as groundHeight,surfaceHeight as terrainHeight,waterLevelAt,WORLD_BOUNDS,WORLD_WIDTH,WORLD_HEIGHT,PLAYER_SPAWN} from './world.js?v=24';
const worldBounds=WORLD_BOUNDS;
import {createPerson,createVehicle,createAircraft} from './entities.js';
import {materials as M,loadPBR} from './materials.js';
import {initializePeople} from './people-detail.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {clamp,circleBox,moveWithCollision,driveStep} from './physics.js';
import {loadModelManifest,mountModel} from './assets.js';
import {loadKitAssets} from './kit/assets.js';
document.body.classList.add('intro-active');
const $=s=>document.querySelector(s),scene=new THREE.Scene();scene.background=new THREE.Color('#b5c5bc');scene.fog=new THREE.FogExp2('#b5c5bc',.000012);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',stencil:false,depth:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.BasicShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;$('#world').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.15,16000);camera.position.set(35,90,-24);
const sky=new Sky();sky.scale.setScalar(4000);scene.add(sky);sky.material.uniforms.turbidity.value=3.5;sky.material.uniforms.rayleigh.value=2.5;sky.material.uniforms.mieCoefficient.value=.004;sky.material.uniforms.mieDirectionalG.value=.83;
const sun=new THREE.DirectionalLight('#ffe0b0',3.2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-120,right:120,top:120,bottom:-120,near:1,far:900});sun.shadow.bias=-.00035;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
const ambient=new THREE.HemisphereLight('#b4ccd0','#52603e',1.6);scene.add(ambient);
const sunDir=new THREE.Vector3(-.5,.43,.4).normalize();sky.material.uniforms.sunPosition.value.copy(sunDir);
const pmrem=new THREE.PMREMGenerator(renderer);const skyScene=new THREE.Scene();skyScene.add(sky.clone());scene.environment=pmrem.fromScene(skyScene,.04,.1,6000).texture;scene.environmentIntensity=.55;pmrem.dispose();
// One synchronized time source drives lighting, the clock and weather.
let time=16.33,atmosphere='sun',quality='medium',timeAdvances=true,started=false,paused=true,driving=null,drivingPlane=null,orbit=0,pitch=.26,camDistance=6.5,firstPerson=false,dragging=false,verticalSpeed=0,elapsed=0,walkPhase=0,waypoint=landmarks[0],visited=new Set(),missionIndex=0,frameCount=0,frameTime=0,toastUntil=0,manifest={},planeSpeed=0,planeThrottle=0,planePitch=0,planeRoll=0;
// Kerala job economy: money earned by working a counter job (serve customers
// on foot) or a vehicle job (drive a taxi/bus between a pickup and drop-off).
let money=Number(localStorage.getItem('kurukkanmoola-x-money'))||0,job=null,customerWaiting=false,customerTimer=0,farePoint=null,fareStage='pickup';
const makePlayerId=()=>{try{if(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')return globalThis.crypto.randomUUID();}catch(e){}return 'kx-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)+'-'+Math.random().toString(36).slice(2,10)};
let playerId=localStorage.getItem('kurukkanmoola-x-player-id')||makePlayerId(),playerName=localStorage.getItem('kurukkanmoola-x-name')||'',playerGender=localStorage.getItem('kurukkanmoola-x-gender')||'male';
const remotePlayers=new Map(); let lastNetwork=0,lastLeaderboard=0;
const music=$('#gameMusic');
function makePlayerLabel(name,gender){
 const c=document.createElement('canvas'); c.width=512; c.height=96; const ctx=c.getContext('2d');
 ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle='rgba(8,22,18,.82)'; ctx.roundRect(8,10,496,76,18); ctx.fill();
 ctx.fillStyle='#eed098'; ctx.font='700 30px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(name).slice(0,18),256,42);
 ctx.fillStyle='#b5c4bc'; ctx.font='18px Arial'; ctx.fillText(gender==='female'?'Female':gender==='male'?'Male':'Other',256,68);
 const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}); const sp=new THREE.Sprite(mat); sp.scale.set(2.25,.42,1); sp.position.y=2.45; sp.renderOrder=20; return sp;
}
function playerColor(gender){return gender==='female'?'#d34b4b':gender==='male'?'#4d8db8':'#a27bc7';}

function startMusic(){music.volume=.30;music.play().catch(()=>{});}
function stopMusic(){music.pause();music.currentTime=0;}

// Lightweight procedural environmental soundscape.
// It uses Web Audio instead of loading several large sound files, so it adds atmosphere
// without increasing the game's download size.
let ambienceCtx=null,ambienceMaster=null,ambienceStarted=false,ambienceTimer=0;
function startEnvironmentAudio(){
 if(ambienceStarted)return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  ambienceCtx=new C();ambienceMaster=ambienceCtx.createGain();ambienceMaster.gain.value=.20;ambienceMaster.connect(ambienceCtx.destination);

  const wind=ambienceCtx.createBufferSource();
  const wb=ambienceCtx.createBuffer(1,ambienceCtx.sampleRate*2,ambienceCtx.sampleRate),wd=wb.getChannelData(0);
  for(let i=0;i<wd.length;i++)wd[i]=(Math.random()*2-1)*.18;
  wind.buffer=wb;wind.loop=true;
  const wf=ambienceCtx.createBiquadFilter();wf.type='lowpass';wf.frequency.value=620;
  const wg=ambienceCtx.createGain();wg.gain.value=.16;
  wind.connect(wf).connect(wg).connect(ambienceMaster);wind.start();

  const birds=ambienceCtx.createGain();birds.gain.value=.055;birds.connect(ambienceMaster);
  const chirp=()=>{
    if(!ambienceCtx||ambienceCtx.state==='closed')return;
    const now=ambienceCtx.currentTime,osc=ambienceCtx.createOscillator(),gain=ambienceCtx.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(1300+Math.random()*700,now);
    osc.frequency.exponentialRampToValueAtTime(2100+Math.random()*700,now+.12);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.16,now+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.18);
    osc.connect(gain).connect(birds);osc.start(now);osc.stop(now+.2);
    ambienceTimer=window.setTimeout(chirp,2500+Math.random()*5000);
  };
  chirp();
  ambienceStarted=true;
 }catch(e){/* audio is optional */ }
}
function setEnvironmentAudioEnabled(on){
 if(!ambienceCtx)return;
 const target=on?.20:0;
 ambienceMaster.gain.cancelScheduledValues(ambienceCtx.currentTime);
 ambienceMaster.gain.linearRampToValueAtTime(target,ambienceCtx.currentTime+.25);
}
function stopEnvironmentAudio(){
 if(ambienceTimer)clearTimeout(ambienceTimer);
 try{ambienceCtx?.close();}catch(e){}
 ambienceCtx=null;ambienceMaster=null;ambienceStarted=false;
}
function networkBase(){return location.origin;}
async function net(path,options={}){try{const r=await fetch(networkBase()+path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});return r.ok?await r.json():null;}catch{return null}}
function sendPlayerState(){if(!started||!playerName)return;const p=activePosition();net('/api/player',{method:'POST',body:JSON.stringify({id:playerId,name:playerName,gender:playerGender,x:p.x,z:p.z,score:visited.size})});}
function disposeRemotePlayer(g){
 if(!g)return;
 scene.remove(g);
 g.traverse(o=>{
  if(o.isMesh){o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material.dispose?.();}}
  if(o.isSprite&&o.material?.map)o.material.map.dispose?.();
 });
}
function buildRemoteCharacter(gender){
 // Use the same full 3D traveller used by the local player instead of a network capsule.
 const person=createPerson('traveller',gender==='female');
 person.mesh.visible=true;
 return person;
}
function renderRemotePlayers(list){
 const seen=new Set();
 for(const p of list||[]){
  if(p.id===playerId)continue; seen.add(p.id);
  let g=remotePlayers.get(p.id);
  const normalizedGender=['male','female','other'].includes(p.gender)?p.gender:'other';
  if(!g){
   g=new THREE.Group();
   const character=buildRemoteCharacter(normalizedGender);
   g.add(character.mesh);
   g.add(makePlayerLabel(p.name,normalizedGender));
   g.userData.target=new THREE.Vector3(Number(p.x)||0,terrainHeight(Number(p.x)||0,Number(p.z)||0),Number(p.z)||0);
   g.userData.lastPosition=new THREE.Vector3(Number(p.x)||0,terrainHeight(Number(p.x)||0,Number(p.z)||0),Number(p.z)||0);
   g.userData.name=p.name; g.userData.gender=normalizedGender;
   g.userData.character=character;
   g.userData.walkPhase=Math.random()*Math.PI*2;
   g.userData.speed=0;
   scene.add(g); remotePlayers.set(p.id,g);
  }else if(g.userData.gender!==normalizedGender){
   // If a player changes gender, replace only the character mesh while keeping network state and label.
   const oldCharacter=g.userData.character;
   if(oldCharacter?.mesh){g.remove(oldCharacter.mesh);oldCharacter.mesh.traverse(o=>{if(o.isMesh){o.geometry?.dispose?.();o.material?.dispose?.();}});}
   const character=buildRemoteCharacter(normalizedGender);
   g.add(character.mesh);
   g.userData.character=character;
   g.userData.gender=normalizedGender;
  }
  const x=Number(p.x)||0,z=Number(p.z)||0;
  g.userData.target.set(x,terrainHeight(x,z),z);
  g.userData.name=p.name;
 }
 for(const [id,g] of remotePlayers){
  if(!seen.has(id)){disposeRemotePlayer(g);remotePlayers.delete(id);}
 }
}
function updateRemotePlayers(dt){
 for(const g of remotePlayers.values()){
  const t=g.userData.target;
  if(!t)continue;
  const before=g.position.clone();
  const alpha=1-Math.exp(-12*dt);
  g.position.lerp(t,alpha);
  const dx=g.position.x-before.x,dz=g.position.z-before.z;
  const distance=Math.hypot(dx,dz);
  const speed=distance/Math.max(dt,.001);
  g.userData.speed=THREE.MathUtils.damp(g.userData.speed||0,Math.min(speed,7),8,dt);
  if(distance>.0005)g.rotation.y=Math.atan2(-dx,-dz);
  const character=g.userData.character;
  if(character){
   g.userData.walkPhase+=(g.userData.speed>.08?dt*(g.userData.speed>3?1.5:1):dt*.2);
   character.animate(g.userData.speed,g.userData.walkPhase);
  }
 }
}

async function syncOnline(){if(!playerName)return;const p=activePosition();const state=await net('/api/state?self='+encodeURIComponent(playerId));if(state){renderRemotePlayers(state.players);$('#onlineCount').textContent=(state.players?.length||0)+' online';if(state.messages?.length){renderMessages(state.messages);}}sendPlayerState();if($('#messages').open)refreshOnlinePlayers();}
function renderMessages(items){const box=$('#messageInbox');if(!box)return;box.innerHTML=items.slice(-20).map(m=>`<div class="message-item"><b>${escapeHtml(m.fromName)}</b> <small>${new Date(m.time).toLocaleTimeString()}</small><br>${escapeHtml(m.text)}</div>`).join('');}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
async function refreshLeaderboard(){const data=await net('/api/leaderboard');const box=$('#leaderboardList');if(!box||!data)return;box.innerHTML=(data.players||[]).map((p,i)=>`<div class="leader-row"><b>#${i+1}</b><span>${escapeHtml(p.name)}<small> · ${p.gender}</small></span><b>${p.score||0}</b></div>`).join('')||'<p>No players yet.</p>';}
async function refreshOnlinePlayers(){const data=await net('/api/players?self='+encodeURIComponent(playerId));const sel=$('#messageTo');if(!sel||!data)return;const current=sel.value;sel.innerHTML='<option value="">Select an online player</option>'+(data.players||[]).map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} · ${escapeHtml(p.gender)}</option>`).join('');if(current)sel.value=current;}

await Promise.all([loadPBR(renderer),initializePeople()]);
const skyHDR=await new RGBELoader().loadAsync('./assets/textures/sky-hdri.hdr');skyHDR.mapping=THREE.EquirectangularReflectionMapping;const hdrPMREM=new THREE.PMREMGenerator(renderer);scene.environment.dispose();scene.environment=hdrPMREM.fromEquirectangular(skyHDR).texture;hdrPMREM.dispose();scene.environmentIntensity=.65;
const kitAssets=await loadKitAssets(renderer);
const world=createWorld(scene,{assets:kitAssets,renderer}),interiors=world.interiors,characters={male:createPerson('traveller'),female:createPerson('traveller',true)};
// Fare marker for taxi/bus jobs: a floating gold ring over the current pickup
// or drop-off point, shown only while the player is actively on that job.
const fareMarker=(()=>{const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.RingGeometry(2.6,3.3,32),new THREE.MeshBasicMaterial({color:'#ffce6b',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;g.add(ring);g.visible=false;scene.add(g);return g;})();
function addMoney(n){money+=n;try{localStorage.setItem('kurukkanmoola-x-money',String(money));}catch{}}
function nearestJobSite(){let best=null,d=Infinity;for(const s of world.jobSites){const n=Math.hypot(player.position.x-s.x,player.position.z-s.z);if(n<d){d=n;best=s;}}return d<6?best:null;}
function randomRoadPoint(cx,cz,minR,maxR){for(let tries=0;tries<30;tries++){const r=roads[Math.floor(Math.random()*roads.length)];if(!r||r.width<4)continue;const t=Math.random(),x=r.a[0]+(r.b[0]-r.a[0])*t,z=r.a[1]+(r.b[1]-r.a[1])*t,d=Math.hypot(x-cx,z-cz);if(d>=minR&&d<=maxR&&!isWater(x,z))return {x,z};}return {x:cx+(Math.random()-.5)*maxR,z:cz+(Math.random()-.5)*maxR};}
function hireJob(site){job={role:site.role,kind:site.kind,pay:site.pay,site,vehicleKinds:site.vehicleKinds||null};customerWaiting=false;customerTimer=3+Math.random()*4;farePoint=null;toast('Hired as '+site.role+'. '+(site.kind==='counter'?'Stay at the counter — a customer will arrive soon.':'Get into the '+site.vehicleKinds[0]+' nearby and press E to start driving.'));}
function clockOutJob(){toast('Clocked out as '+job.role+'. Earned today: ₹'+money+'.');job=null;customerWaiting=false;farePoint=null;fareMarker.visible=false;}
function serveCustomer(){const amt=job.pay+Math.round(Math.random()*job.pay*.5);addMoney(amt);customerWaiting=false;customerTimer=4+Math.random()*6;toast('Served a customer. +₹'+amt);}
function updateJob(dt){
 if(!job)return;
 if(job.kind==='counter'){
  const atSite=!driving&&!drivingPlane&&Math.hypot(player.position.x-job.site.x,player.position.z-job.site.z)<6;
  if(atSite&&!customerWaiting){customerTimer-=dt;if(customerTimer<=0){customerWaiting=true;toast('A customer is waiting — press F to serve.');}}
 }else{
  const v=driving,active=v&&job.vehicleKinds.includes(v.kind);
  fareMarker.visible=active;
  if(active){
   if(!farePoint){farePoint=randomRoadPoint(v.mesh.position.x,v.mesh.position.z,120,500);fareStage='pickup';toast('Pick up the passenger at the gold marker.');}
   fareMarker.position.set(farePoint.x,terrainHeight(farePoint.x,farePoint.z)+1.6,farePoint.z);
   if(Math.hypot(v.mesh.position.x-farePoint.x,v.mesh.position.z-farePoint.z)<9){
    if(fareStage==='pickup'){fareStage='dropoff';farePoint=randomRoadPoint(v.mesh.position.x,v.mesh.position.z,150,700);toast('Passenger aboard — drive to the drop-off marker.');}
    else{const fare=job.pay+Math.round(Math.random()*job.pay*.6);addMoney(fare);toast('Trip complete! +₹'+fare);farePoint=null;}
   }
  }else if(farePoint){farePoint=null;fareMarker.visible=false;}
 }
}
function interact(){
 const p=activePosition();
 if(job&&job.kind==='counter'&&customerWaiting&&!driving&&!drivingPlane&&Math.hypot(p.x-job.site.x,p.z-job.site.z)<6){serveCustomer();return;}
 const site=!driving&&!drivingPlane?nearestJobSite():null;
 if(site){if(job&&job.site===site){clockOutJob();}else{hireJob(site);}return;}
 talk();
}
// AI traffic follows actual road centerlines instead of moving on a hard-coded Z axis.
// Each route is composed directly from the world road segments, so vehicles stay on the
// same coordinate system used by the road meshes, minimap and collision checks.
const TRAFFIC_ROUTE_NAMES=['Dam Road','East Highway','South Backwater Road','West River Road','North Town Road','East Town Road','West Market Road','College Road'];
function buildTrafficRoute(name){
 const segs=roads.filter(r=>r.name===name);
 if(!segs.length)return null;
 const pts=[segs[0].a.slice(),segs[0].b.slice()];
 for(let i=1;i<segs.length;i++){
  const a=segs[i].a,b=segs[i].b,last=pts[pts.length-1];
  const da=Math.hypot(a[0]-last[0],a[1]-last[1]);
  const db=Math.hypot(b[0]-last[0],b[1]-last[1]);
  if(da<=db) pts.push(a.slice(),b.slice()); else pts.push(b.slice(),a.slice());
 }
 const compact=[]; for(const pt of pts){const last=compact[compact.length-1]; if(!last||Math.hypot(pt[0]-last[0],pt[1]-last[1])>.01)compact.push(pt);}
 return {name,points:compact,width:segs[0].width};
}
const trafficRoutes=TRAFFIC_ROUTE_NAMES.map(buildTrafficRoute).filter(Boolean);
function routePose(route,index,t,offset){
 const pts=route.points; const i=Math.max(0,Math.min(pts.length-2,index)); const a=pts[i],b=pts[i+1];
 const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.max(.001,Math.hypot(dx,dz));
 const nx=-dz/len,nz=dx/len;
 return {x:a[0]+(b[0]-a[0])*t+nx*offset,z:a[1]+(b[1]-a[1])*t+nz*offset,yaw:Math.atan2(dx,-dz),len};
}
function setupTrafficRoutes(){}
setupTrafficRoutes();
const SPAWN=PLAYER_SPAWN;const player=new THREE.Group();player.position.set(SPAWN.x,terrainHeight(SPAWN.x,SPAWN.z)+0.25,SPAWN.z);scene.add(player);for(const person of Object.values(characters)){player.add(person.mesh);person.mesh.visible=false;}let character='male';characters.male.mesh.visible=true;
const externalCharacters={},externalVehicles=new Map(),externalNpcs=new Map();
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.10,.35,1.2);composer.addPass(bloom);composer.addPass(new OutputPass());
const rainCount=1800,rainPositions=new Float32Array(rainCount*6);for(let i=0;i<rainCount;i++){const n=i*6;rainPositions[n]=(Math.random()-.5)*90;rainPositions[n+1]=Math.random()*45;rainPositions[n+2]=(Math.random()-.5)*90;rainPositions[n+3]=rainPositions[n]+.12;rainPositions[n+4]=rainPositions[n+1]-.8;rainPositions[n+5]=rainPositions[n+2];}const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#c0d9de',transparent:true,opacity:.3,depthWrite:false}));scene.add(rain);rain.visible=false;
const keys=new Set();const dialogs=[...document.querySelectorAll('dialog')];
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;toastUntil=performance.now()+4300;}
function activePosition(){return drivingPlane?startupPlane.position:driving?driving.mesh.position:player.position;}
function syncPause(){paused=!started||dialogs.some(d=>d.open)||document.hidden;keys.clear();}
function openDialog(id){const d=$('#'+id);if(!d.open)d.showModal();syncPause();}
function closeDialog(id){$('#'+id).close();syncPause();}
for(const d of dialogs){d.addEventListener('close',syncPause);d.addEventListener('cancel',()=>setTimeout(syncPause));}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));
$('#pauseButton').onclick=()=>openDialog('pause');$('#resume').onclick=()=>closeDialog('pause');$('#referenceButton').onclick=()=>openDialog('references');$('#leaderboardButton').onclick=()=>{openDialog('leaderboard');refreshLeaderboard();};$('#messageButton').onclick=()=>{openDialog('messages');refreshOnlinePlayers();};$('#sceneLeaderboard').onclick=()=>{openDialog('leaderboard');refreshLeaderboard();};$('#sceneMessages').onclick=()=>{openDialog('messages');refreshOnlinePlayers();};$('#sendMessage').onclick=async()=>{const to=$('#messageTo').value.trim(),text=$('#messageText').value.trim();if(!to||!text)return toast('Enter a player ID and message.');const r=await net('/api/message',{method:'POST',body:JSON.stringify({from:playerId,to,text})});if(r?.ok){$('#messageText').value='';toast('Private message sent.');}else toast('Player not found or offline.');};
$('#play').onclick=async()=>{playerName=$('#playerName').value.trim()||'Player';playerGender=$('#genderSelect').value;localStorage.setItem('kurukkanmoola-x-name',playerName);localStorage.setItem('kurukkanmoola-x-gender',playerGender);localStorage.setItem('kurukkanmoola-x-player-id',playerId);await net('/api/player',{method:'POST',body:JSON.stringify({id:playerId,name:playerName,gender:playerGender,x:player.position.x,z:player.position.z,score:visited.size})});startEnvironmentAudio();setEnvironmentAudioEnabled(true);started=true;document.body.classList.remove('intro-active');$('#start').hidden=true;stopMusic();orbit=0;camDistance=6.5;camera.position.copy(player.position).add(new THREE.Vector3(0,2.9,6.5));syncPause();toast('Welcome to Kurukkanmoola X. Other players are live in your world.');};
$('#reset').onclick=()=>{if(drivingPlane){drivingPlane=null;planeSpeed=0;planeThrottle=0;startupPlane.position.copy(startupPlane.userData.home);startupPlane.rotation.set(0,0,0);player.visible=true;}if(driving){driving.speed=0;driving=null;player.visible=true;}player.position.set(SAFE_SPAWN.x,SAFE_SPAWN.y,SAFE_SPAWN.z);verticalSpeed=0;orbit=0;firstPerson=false;camDistance=6.5;camera.position.copy(player.position).add(new THREE.Vector3(0,2.9,6.5));closeDialog('pause');toast('Returned to the town entrance.');};
const refNames=['Character','Vehicles','Street','Overview','Buildings','NPCs','Map','Landscape target','World layout'];const refFiles=['01-character','02-vehicles','03-street','04-overview','05-buildings','06-npcs','07-map','08-landscape-target','09-world-layout'];refNames.forEach((name,i)=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>{document.querySelectorAll('#referenceTabs button').forEach(c=>c.classList.remove('active'));b.classList.add('active');$('#referenceImage').src='assets/references/'+refFiles[i]+'.png';$('#referenceImage').alt=name+' reference sheet';};$('#referenceTabs').appendChild(b);if(!i)b.click();});
landmarks.forEach(l=>{const b=document.createElement('button');b.textContent='◇ '+l.name;b.onclick=()=>{waypoint=l;closeDialog('fullMap');toast('Waypoint set: '+l.name);};$('#landmarkList').appendChild(b);});
world.parked.forEach(v=>{const b=document.createElement('button');b.textContent=v.spec.name;b.onclick=()=>{waypoint={name:v.spec.name,get x(){return v.mesh.position.x;},get z(){return v.mesh.position.z;}};closeDialog('garage');toast('Find '+v.spec.name+' at the blue map marker.');};$('#vehicleList').appendChild(b);});
function blocked(x,z,r=.32,ignoreVehicle=null){
 // Collision: world bounds, open-water barriers, solid structures (CollisionWorld: oriented boxes in a spatial hash) and other vehicles.
 if(x<worldBounds.west+r||x>worldBounds.east-r||z<worldBounds.south+r||z>worldBounds.north-r)return true;
 const nearby=nearestRoad(x,z);if(isWater(x,z)&&nearby.distance>nearby.road.width/2-r)return true;
 {const py=activePosition().y;if(world.collision.circleHits(x,z,r,py-.4,py+1.75))return true;}
 for(const v of [...world.parked,...world.traffic]){if(v===ignoreVehicle)continue;const dx=x-v.mesh.position.x,dz=z-v.mesh.position.z,a=-v.mesh.rotation.y;const lx=Math.cos(a)*dx+Math.sin(a)*dz,lz=-Math.sin(a)*dx+Math.cos(a)*dz;if(circleBox(lx,lz,r,{minX:-v.spec.width/2,maxX:v.spec.width/2,minZ:-v.length/2,maxZ:v.length/2}))return true;}
 return false;
}
function structureBlocksVehicle(x,z,r=.7){ return !!world.collision.circleHits(x,z,r); }
function findSafeSpawn(){
  const candidates=[PLAYER_SPAWN,{x:0,z:650},{x:-80,z:650},{x:80,z:650},{x:0,z:520},{x:-120,z:520},{x:120,z:520}];
  for(const c of candidates){const y=terrainHeight(c.x,c.z);if(!isWater(c.x,c.z)&&!blocked(c.x,c.z,.34))return {x:c.x,z:c.z,y};}
  return {x:0,z:650,y:terrainHeight(0,650)};
}
function vehicleBlocked(x,z,v){const a=v.mesh.rotation.y,offset=v.length*.34;
 for(const p of [-offset,0,offset]){const px=x-Math.sin(a)*p,pz=z-Math.cos(a)*p;
   if(blocked(px,pz,v.spec.width*.45,v))return true;
   if(structureBlocksVehicle(px,pz,Math.max(.7,v.spec.width*.42)))return true;
 }
 return false;
}
const SAFE_SPAWN=findSafeSpawn();
player.position.set(SAFE_SPAWN.x,SAFE_SPAWN.y+.18,SAFE_SPAWN.z);
// A bicycle is always available beside the player at startup.
const spawnBike=createVehicle('bicycle');
let bikeX=SAFE_SPAWN.x+2.6, bikeZ=SAFE_SPAWN.z+1.2;
for(const candidate of [[SAFE_SPAWN.x+2.6,SAFE_SPAWN.z+1.2],[SAFE_SPAWN.x-2.6,SAFE_SPAWN.z+1.2],[SAFE_SPAWN.x+2.6,SAFE_SPAWN.z-1.2],[SAFE_SPAWN.x-2.6,SAFE_SPAWN.z-1.2]]){
  if(!blocked(candidate[0],candidate[1],.55)){bikeX=candidate[0];bikeZ=candidate[1];break;}
}
spawnBike.mesh.position.set(bikeX,terrainHeight(bikeX,bikeZ),bikeZ);
spawnBike.mesh.rotation.y=0;
scene.add(spawnBike.mesh);
world.parked.unshift(spawnBike);
// A flyable Mugeena aircraft is parked beside the player at every start.
const startupPlane=createAircraft('Mugeena');
startupPlane.userData.flyable=true;
startupPlane.userData.length=5.8;
startupPlane.userData.width=5.9;
startupPlane.userData.home=new THREE.Vector3(SPAWN.x+4.5,terrainHeight(SPAWN.x+4.5,SPAWN.z+1.2)+0.38,SPAWN.z+1.2);
startupPlane.position.copy(startupPlane.userData.home);
startupPlane.rotation.y=0;
scene.add(startupPlane);
function nearestVehicle(){let best=null,d=Infinity;for(const v of world.parked){const n=player.position.distanceTo(v.mesh.position);if(n<d){d=n;best=v;}}return d<4.8?best:null;}
function nearestPlane(){const n=player.position.distanceTo(startupPlane.position);return n<6.5?startupPlane:null;}
function updatePlane(dt){
  if(!drivingPlane){
    const ground=terrainHeight(startupPlane.position.x,startupPlane.position.z)+0.38;
    startupPlane.position.y=ground;
    planeSpeed=0;
    planePitch=0;
    planeRoll=0;
    return;
  }
  const throttleUp=keys.has('KeyW')||keys.has('ArrowUp');
  const throttleDown=keys.has('KeyS')||keys.has('ArrowDown');
  const yawLeft=keys.has('KeyA')||keys.has('ArrowLeft');
  const yawRight=keys.has('KeyD')||keys.has('ArrowRight');
  const climb=keys.has('Space');
  const descend=keys.has('ControlLeft')||keys.has('ControlRight');
  planeThrottle=THREE.MathUtils.clamp(planeThrottle+(throttleUp?0.38:-0.12)*dt+(throttleDown?-0.6:0),0,1);
  const targetSpeed=planeThrottle*34;
  planeSpeed=THREE.MathUtils.damp(planeSpeed,targetSpeed,1.9,dt);
  const targetRoll=(yawRight?1:0)-(yawLeft?1:0);
  planeRoll=THREE.MathUtils.damp(planeRoll,targetRoll*0.62,3.6,dt);
  const targetPitch=(climb?1:0)-(descend?1:0);
  planePitch=THREE.MathUtils.damp(planePitch,targetPitch*0.42,3.4,dt);
  startupPlane.rotation.z=-planeRoll;
  startupPlane.rotation.x=planePitch;
  startupPlane.rotation.y+=Math.sin(planeRoll)*0.9*dt;
  const yaw=startupPlane.rotation.y,p=planePitch;
  const forward=new THREE.Vector3(-Math.sin(yaw)*Math.cos(p),Math.sin(p),-Math.cos(yaw)*Math.cos(p));
  startupPlane.position.addScaledVector(forward,planeSpeed*dt);
  // Keep the aircraft inside the master world and above terrain/water.
  startupPlane.position.x=clamp(startupPlane.position.x,worldBounds.west+12,worldBounds.east-12);
  startupPlane.position.z=clamp(startupPlane.position.z,worldBounds.south+12,worldBounds.north-12);
  const ground=Math.max(terrainHeight(startupPlane.position.x,startupPlane.position.z),isWater(startupPlane.position.x,startupPlane.position.z)?waterLevelAt(startupPlane.position.x,startupPlane.position.z):0)+1.0;
  if(startupPlane.position.y<ground){
    startupPlane.position.y=ground;
    if(planeSpeed<8)planePitch=0;
  }
  // Take off only after enough forward speed; landing happens automatically when terrain is reached.
  if(startupPlane.position.y<=ground+1.05 && planeSpeed<9){
    planePitch=0;
    planeRoll=THREE.MathUtils.damp(planeRoll,0,5,dt);
  }
  currentSpeed=planeSpeed;
  player.position.copy(startupPlane.position);
  player.rotation.y=startupPlane.rotation.y;
}

// ---- Tea shops: walk in through the door, order at the counter, leave again -----------------------------------
let teaReturn=null,savedCamDistance=6.5;
function spendMoney(n){if(money<n)return false;money-=n;try{localStorage.setItem('kurukkanmoola-x-money',String(money));}catch{}return true;}
function teaShopNearby(){if(driving||drivingPlane||interiors.active)return null;for(const t of world.teaShops)if(Math.hypot(t.x-player.position.x,t.z-player.position.z)<3.2)return t;return null;}
async function fadeThen(fn){const f=$('#fade');f.classList.add('on');await new Promise(r=>setTimeout(r,240));fn();await new Promise(r=>setTimeout(r,120));f.classList.remove('on');}
function enterTeaShop(t){fadeThen(()=>{teaReturn=t;interiors.enter(t);const s=interiors.state.spawn;player.position.set(s.x,s.y+.18,s.z);verticalSpeed=0;savedCamDistance=camDistance;camDistance=2.7;orbit=0;});}
function exitTeaShop(){fadeThen(()=>{const t=teaReturn||interiors.state.shop;interiors.exit();const x=t.x+Math.sin(t.yaw)*1.7,z=t.z+Math.cos(t.yaw)*1.7;player.position.set(x,terrainHeight(x,z)+.18,z);verticalSpeed=0;camDistance=savedCamDistance;orbit=t.yaw+Math.PI;});}
function openTeaMenu(){
 const box=$('#teaItems');box.innerHTML='';
 interiors.menu.forEach((it,i)=>{const b=document.createElement('button');b.innerHTML='<span><kbd>'+(i+1)+'</kbd>'+it.name+'</span><b>₹'+it.price+'</b>';b.disabled=money<it.price;b.onclick=()=>buyItem(it);box.appendChild(b);});
 $('#teaMoney').textContent='₹'+money;openDialog('teaMenu');
}
function buyItem(it){
 if(!spendMoney(it.price)){toast('Not enough money — '+it.name+' costs ₹'+it.price+'.');return;}
 toast('Bought '+it.name+' · −₹'+it.price+(it.kind==='drink'?' · Ahh, that hits the spot.':' · Hot and crispy!'));
 interiors.flourish(it);$('#teaMoney').textContent='₹'+money;$('#jobMoney').textContent='₹'+money;
 [...$('#teaItems').children].forEach((b,i)=>{b.disabled=money<interiors.menu[i].price;});
}
document.addEventListener('keydown',e=>{const d=$('#teaMenu');if(!d||!d.open)return;const n=+e.key;if(n>=1&&n<=interiors.menu.length){e.preventDefault();buyItem(interiors.menu[n-1]);}});
function enterExit(){
 if(interiors.active){const q=player.position;if(interiors.nearCounter(q)){openTeaMenu();return;}if(interiors.nearDoor(q)){exitTeaShop();return;}toast('Walk to the counter to order tea, or to the door to leave.');return;}
 {const ts=teaShopNearby();if(ts){enterTeaShop(ts);return;}}
 if(drivingPlane){
   const ground=Math.max(terrainHeight(startupPlane.position.x,startupPlane.position.z),isWater(startupPlane.position.x,startupPlane.position.z)?waterLevelAt(startupPlane.position.x,startupPlane.position.z):0)+1.0;
   if(startupPlane.position.y>ground+2.5||planeSpeed>5.5){toast('Land the plane and slow down before exiting.');return;}
   const a=startupPlane.rotation.y,ox=3.2,x=startupPlane.position.x+Math.cos(a)*ox,z=startupPlane.position.z-Math.sin(a)*ox;
   if(blocked(x,z,.45)){toast('No clear place to exit the plane.');return;}
   player.position.set(x,terrainHeight(x,z)+.18,z); player.rotation.y=a; player.visible=true;
   drivingPlane=null; planeThrottle=0; planeSpeed=0; planePitch=0; planeRoll=0; startupPlane.rotation.x=0; startupPlane.rotation.z=0; firstPerson=false; camDistance=8; toast('Back on foot.');
   return;
 }
 if(driving){if(Math.abs(driving.speed)>1.2){toast('Brake to a stop before getting out.');return;}const v=driving;let exit=null;for(const side of [1,-1])for(const back of [0,v.length*.65,-v.length*.65]){const ox=side*(v.spec.width/2+.85),a=v.mesh.rotation.y,x=v.mesh.position.x+Math.cos(a)*ox+Math.sin(a)*back,z=v.mesh.position.z-Math.sin(a)*ox+Math.cos(a)*back;if(!blocked(x,z,.32,v)){exit={x,z};break;}}if(!exit){toast('No clear exit here. Move the vehicle a little.');return;}player.position.set(exit.x,terrainHeight(exit.x,exit.z),exit.z);player.rotation.y=v.mesh.rotation.y;player.visible=true;v.speed=0;driving=null;firstPerson=false;camDistance=6.5;toast('Back on foot.');
 }else{
   const plane=nearestPlane();
   if(plane){drivingPlane=plane;player.visible=false;planeSpeed=0;planeThrottle=0.2;orbit=plane.rotation.y;camDistance=11;toast('Mugeena · W throttle · A/D turn · Space climb · Ctrl descend · E exit after landing');return;}
   const v=nearestVehicle();if(!v){toast('Move closer to a parked vehicle.');return;}driving=v;player.visible=['bike','sport','scooter','moped','bicycle'].includes(v.kind);v.speed=0;v.steer=0;orbit=v.mesh.rotation.y;camDistance=Math.max(8,v.length*1.35);toast(v.spec.name+' · W/S accelerate & reverse · Space brakes');
 }
}
function talk(){const p=activePosition();let npc=world.npcs.find(n=>n.mesh.position.distanceTo(p)<3.5);if(!npc||driving){toast('Walk closer to someone to talk.');return;}$('#npcName').textContent=npc.name;$('#npcWords').textContent=npc.words;openDialog('conversation');}
window.addEventListener('keydown',e=>{
 const k=e.code;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(k)&&!paused)e.preventDefault();if(e.repeat)return;
 if(k==='Escape'){if(!dialogs.some(d=>d.open)&&started){e.preventDefault();openDialog('pause');}return;}
 if(paused)return;keys.add(k);
 if(k==='KeyE')enterExit();if(k==='KeyF')interact();if(k==='KeyM')openDialog('fullMap');if(k==='KeyV')openDialog('garage');if(k==='KeyH')document.body.classList.toggle('hide-hud');if(k==='KeyT'){const list=['sun','cloud','rain','night'];setWeather(list[(list.indexOf(atmosphere)+1)%4]);}if(k==='KeyC'){firstPerson=!firstPerson;toast(firstPerson?'First-person camera':'Third-person camera');}
 if(k==='Space'&&!driving&&!drivingPlane&&player.position.y<terrainHeight(player.position.x,player.position.z)+.22)verticalSpeed=5;
});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(started&&!dialogs.some(d=>d.open))openDialog('pause');});document.addEventListener('visibilitychange',syncPause);
renderer.domElement.addEventListener('pointerdown',e=>{if(paused)return;dragging=true;renderer.domElement.setPointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointerup',()=>dragging=false);renderer.domElement.addEventListener('pointercancel',()=>dragging=false);renderer.domElement.addEventListener('pointermove',e=>{if(!dragging||paused)return;orbit-=e.movementX*.004;pitch=clamp(pitch+e.movementY*.003,-.12,.85);});renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();camDistance=clamp(camDistance+e.deltaY*.008,3,24);},{passive:false});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
function setQuality(q){quality=q;renderer.setPixelRatio(Math.min(devicePixelRatio,q==='high'?1.25:q==='medium'?.9:.75));renderer.shadowMap.enabled=q!=='low';const shadowSize=q==='high'?1536:q==='medium'?1024:512;sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;composer.setPixelRatio(renderer.getPixelRatio());bloom.enabled=false;$('#quality').value=q;}
$('#quality').onchange=e=>setQuality(e.target.value);
function setWeather(w){atmosphere=w;$('#weatherSelect').value=w;rain.visible=w==='rain';if(w==='night')time=21.5;else if(time>19||time<6)time=16.33;M.road.roughness=w==='rain'?.24:.92;M.road.metalness=w==='rain'?.18:0;world.roadMaterials.forEach(m=>{m.roughness=M.road.roughness;m.metalness=M.road.metalness;});$('#weather').textContent={sun:'Golden hour',cloud:'Overcast',rain:'Monsoon',night:'Night'}[w];$('#weatherIcon').textContent={sun:'☀',cloud:'☁',rain:'☂',night:'☾'}[w];}
$('#weatherSelect').onchange=e=>setWeather(e.target.value);$('#timeToggle').onchange=e=>timeAdvances=e.target.checked;
$('#characterSelect').onchange=e=>{characters[character].mesh.visible=false;character=e.target.value;characters[character].mesh.visible=!drivingPlane;};
function updateLights(dt){
 if(!paused&&timeAdvances)time=(time+dt*.004)%24;
 const angle=(time-6)/12*Math.PI,day=Math.max(0,Math.sin(angle)),night=day<.05,weatherFactor=atmosphere==='rain'?.35:atmosphere==='cloud'?.58:1;
 sunDir.set(Math.cos(angle)*.78,Math.max(.08,day),.42).normalize();sky.material.uniforms.sunPosition.value.copy(sunDir);sky.visible=false;
 const skyColor=new THREE.Color(night?'#132331':atmosphere==='rain'?'#7b9291':atmosphere==='cloud'?'#adb7ac':'#a8c7ce');if(!night&&atmosphere==='sun'){scene.background=skyHDR;scene.backgroundIntensity=.65;}else{scene.background=skyColor;scene.backgroundIntensity=1;}scene.fog.color.copy(skyColor);scene.fog.density=atmosphere==='rain'?.00011:atmosphere==='cloud'?.00008:.00006;
 sun.intensity=night?.12:weatherFactor*(1.3+day*2.3);sun.color.set(night?'#89b3df':day<.3?'#ffb673':'#ffdfac');ambient.intensity=night?.3:.35+weatherFactor*.4;renderer.toneMappingExposure=night?.9:1.0;
 scene.environmentIntensity=night?.12:weatherFactor*.65;
 const pos=activePosition();sun.position.copy(pos).addScaledVector(sunDir,120);sun.target.position.copy(pos);sun.target.updateMatrixWorld();
 world.update(elapsed,pos,quality);
 world.atmosphere.update(.016,elapsed,activePosition(),day,atmosphere);world.setNight(world.atmosphere.night);M.lamp.emissiveIntensity=night?2:.5;
 for(const v of world.parked)for(const l of v.lights)l.intensity=night&&v===driving?45:0;for(const v of world.traffic)for(const l of v.lights)l.intensity=night&&v.mesh.position.distanceTo(pos)<70?35:0;
 if(rain.visible&&!paused){rain.position.set(pos.x,terrainHeight(pos.x,pos.z)+35,pos.z);for(let i=0;i<rainCount;i++){const n=i*6;rainPositions[n+1]-=dt*25;rainPositions[n+4]-=dt*25;if(rainPositions[n+1]<0){rainPositions[n+1]=45;rainPositions[n+4]=44.2;}}rainGeo.attributes.position.needsUpdate=true;}
 $('#clock').textContent=String(Math.floor(time)).padStart(2,'0')+':'+String(Math.floor(time%1*60)).padStart(2,'0');

 if(interiors.active){sun.intensity=0;ambient.intensity=1.5;scene.environmentIntensity=.35;scene.background=new THREE.Color('#2a211a');scene.fog.density=0;}
}
let currentSpeed=0;
function updatePlayer(dt){
 if(drivingPlane){updatePlane(dt);return;}
 if(!driving){const py=player.position.y,pu=world.collision.pushOut(player.position.x,player.position.z,.3,py-.3,py+1.7);if(pu.hit){player.position.x=pu.x;player.position.z=pu.z;}}
 const forward=keys.has('KeyW')||keys.has('ArrowUp'),backward=keys.has('KeyS')||keys.has('ArrowDown'),left=keys.has('KeyA')||keys.has('ArrowLeft'),right=keys.has('KeyD')||keys.has('ArrowRight');
 if(driving){const v=driving,state={speed:v.speed,steer:v.steer,yaw:v.mesh.rotation.y,wheelbase:v.length*.62};const before=v.mesh.rotation.y;const delta=driveStep(state,{forward,backward,left,right,brake:keys.has('Space')},dt,v.spec.max);v.mesh.rotation.y=state.yaw;
  if(vehicleBlocked(v.mesh.position.x,v.mesh.position.z,v))v.mesh.rotation.y=before;
  const hit=moveWithCollision(v.mesh.position,delta.dx,delta.dz,(x,z)=>vehicleBlocked(x,z,v));v.speed=hit?state.speed*.25:state.speed;v.steer=state.steer;currentSpeed=Math.abs(v.speed);
  v.mesh.position.y=terrainHeight(v.mesh.position.x,v.mesh.position.z)+.08;const sample=Math.max(1,v.length*.35),fx=-Math.sin(v.mesh.rotation.y)*sample,fz=-Math.cos(v.mesh.rotation.y)*sample;const tilt=Math.atan2(terrainHeight(v.mesh.position.x+fx,v.mesh.position.z+fz)-terrainHeight(v.mesh.position.x-fx,v.mesh.position.z-fz),sample*2);v.visual.rotation.x=THREE.MathUtils.damp(v.visual.rotation.x,tilt,8,dt);
  v.wheels.forEach(w=>w.rotation.x-=v.speed*dt/.34);v.visual.rotation.z=THREE.MathUtils.damp(v.visual.rotation.z,-v.steer*v.speed*.007,5,dt);player.position.copy(v.mesh.position);player.rotation.y=v.mesh.rotation.y;
  if(player.visible){player.position.y=terrainHeight(player.position.x,player.position.z)+.22;characters[character].arms.forEach(a=>a.rotation.x=-.7);characters[character].legs.forEach(a=>a.rotation.x=-.8);}
  if(!dragging)orbit+=Math.atan2(Math.sin(v.mesh.rotation.y-orbit),Math.cos(v.mesh.rotation.y-orbit))*(1-Math.exp(-3*dt));externalVehicles.get(v)?.update(dt,'drive');
 }else{
  const x=(right?1:0)-(left?1:0),z=(backward?1:0)-(forward?1:0),len=Math.hypot(x,z),speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?5.6:2.6;
  if(len){const dx=(Math.cos(orbit)*x+Math.sin(orbit)*z)/len,dz=(-Math.sin(orbit)*x+Math.cos(orbit)*z)/len;const before=player.position.clone();moveWithCollision(player.position,dx*speed*dt,dz*speed*dt,(a,b)=>blocked(a,b));currentSpeed=player.position.distanceTo(before)/dt;const target=Math.atan2(-dx,-dz);player.rotation.y+=Math.atan2(Math.sin(target-player.rotation.y),Math.cos(target-player.rotation.y))*(1-Math.exp(-14*dt));}else currentSpeed=0;
  verticalSpeed-=12*dt;const groundY=interiors.active?interiors.floorY:terrainHeight(player.position.x,player.position.z);const targetGround=groundY+.18;player.position.y=Math.max(targetGround,player.position.y+verticalSpeed*dt);if(player.position.y<=targetGround+.001)verticalSpeed=0;walkPhase+=dt*(currentSpeed>3?1.5:1);characters[character].animate(currentSpeed,walkPhase);externalCharacters[character]?.update(dt,player.position.y>groundY+.3?'jump':currentSpeed>3?'run':currentSpeed>.1?'walk':'idle');
 }
}
function updateTraffic(dt){
 // Graph-based traffic (src/systems/traffic.js): left-hand lanes, junction yielding, roundabout, pooled around the active position.
 const ap=activePosition(),obstacles=[],near=p=>Math.abs(p.x-ap.x)<90&&Math.abs(p.z-ap.z)<90;
 if(driving&&driving.mesh)obstacles.push({x:driving.mesh.position.x,z:driving.mesh.position.z,r:Math.max(1.4,driving.length*.5)});
 else if(!drivingPlane)obstacles.push({x:player.position.x,z:player.position.z,r:.6});
 for(const n of world.npcs){const p=n.mesh.position;if(near(p))obstacles.push({x:p.x,z:p.z,r:.55});}
 for(const v of world.parked){const p=v.mesh.position;if(v!==driving&&near(p))obstacles.push({x:p.x,z:p.z,r:v.length*.5});}
 const day=Math.max(0,Math.sin((time-6)/12*Math.PI));
 world.trafficSys.update(dt,ap,obstacles,{quality,time:elapsed,rain:atmosphere==='rain',night:day<.05});
 world.npcLife.update(dt,ap,elapsed);
 interiors.update(dt,elapsed,player.position);
 for(const n of world.npcs)externalNpcs.get(n)?.update(dt,n.speed>.1?'walk':'idle');
 world.boats.forEach((b,i)=>{b.mesh.position.y=b.baseY+Math.sin(elapsed*.7+i)*.06;b.mesh.rotation.z=Math.sin(elapsed*.4+i)*.009;});
}
function updateMission(){
 const p=activePosition();for(const l of landmarks)if(!visited.has(l.name)&&Math.hypot(p.x-l.x,p.z-l.z)<10){visited.add(l.name);toast('Discovered: '+l.name);saveProgress();}
 while(missionIndex<landmarks.length&&visited.has(landmarks[missionIndex].name))missionIndex++;
 if(waypoint&&visited.has(waypoint.name)&&landmarks.includes(waypoint))waypoint=landmarks[missionIndex]||null;
 $('#missionTitle').textContent=missionIndex===landmarks.length?'You know your way around.':'Discover '+landmarks[missionIndex].name;
 $('#missionText').textContent=missionIndex===landmarks.length?'Every landmark visited. Keep exploring at your own pace.':landmarks[missionIndex].description+' · '+visited.size+' / '+landmarks.length+' discovered';
 $('#progress').innerHTML=landmarks.map(l=>'<i class="'+(visited.has(l.name)?'done':'')+'"></i>').join('');
 $('#distance').textContent=waypoint?waypoint.name+' · '+Math.round(Math.hypot(p.x-waypoint.x,p.z-waypoint.z))+' m':'Free exploration';
 world.markers.forEach((g,i)=>{g.visible=p.distanceTo(g.position)<90;g.children[0].material.opacity=visited.has(landmarks[i].name)?.18:.6+Math.sin(elapsed*2)*.15;});
}
function saveProgress(){try{localStorage.setItem('perunna-v2-progress',JSON.stringify([...visited]));}catch{}}
try{const saved=JSON.parse(localStorage.getItem('perunna-v2-progress')||'[]');if(Array.isArray(saved))visited=new Set(saved.filter(x=>landmarks.some(l=>l.name===x)));}catch{}
function drawMap(canvas,large=false){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,p=activePosition(),cx=large?0:p.x,cz=large?0:p.z,radius=700,scale=large?Math.min(w/WORLD_WIDTH,h/WORLD_HEIGHT)*.96:Math.min(w/(radius*2),h/(radius*2));
 const point=(x,z)=>[(x-cx)*scale+w/2,-(z-cz)*scale+h/2];c.fillStyle='#20372c';c.fillRect(0,0,w,h);
 const [left,top]=point(-6000,4150);c.drawImage(world.mapCanvas,left,top,WORLD_WIDTH*scale,WORLD_HEIGHT*scale);
 for(const l of landmarks){const [x,y]=point(l.x,l.z);if(x<-30||x>w+30||y<-20||y>h+20)continue;c.fillStyle=visited.has(l.name)?'#8baa7b':'#e8ca8f';c.beginPath();c.arc(x,y,large?5:3,0,Math.PI*2);c.fill();if(large){c.font='12px Arial';c.fillStyle='#edf0d9';c.fillText(l.name,x+9,y-7);}}
 if(waypoint){const [x,y]=point(waypoint.x,waypoint.z);if(x>-20&&x<w+20&&y>-20&&y<h+20){c.strokeStyle='#efd091';c.lineWidth=1.5;c.beginPath();c.arc(x,y,large?12:9,0,Math.PI*2);c.stroke();const [px,py]=point(p.x,p.z);c.setLineDash([3,5]);c.beginPath();c.moveTo(px,py);c.lineTo(x,y);c.globalAlpha=.4;c.stroke();c.globalAlpha=1;c.setLineDash([]);}}
 const [x,y]=point(p.x,p.z);c.save();c.translate(x,y);c.rotate(Math.PI+(drivingPlane?startupPlane.rotation.y:driving?driving.mesh.rotation.y:player.rotation.y));c.fillStyle='#f6edd0';c.strokeStyle='#172b24';c.lineWidth=2;c.beginPath();c.moveTo(0,-9);c.lineTo(-6,6);c.lineTo(0,3);c.lineTo(6,6);c.closePath();c.fill();c.stroke();c.restore();
}
const ray=new THREE.Raycaster(),look=new THREE.Vector3(),desired=new THREE.Vector3();
function updateCamera(dt){
 if(!started){const a=elapsed*.018;camera.position.set(-35+Math.sin(a)*3,terrainHeight(-35,690)+7,690);camera.lookAt(50,terrainHeight(50,520)+3,520);return;}
 const p=activePosition();look.copy(p);look.y+=drivingPlane?2.3:driving?Math.min(2.2,driving.length*.19+1):1.5;
 if(firstPerson){desired.copy(look);desired.y+=drivingPlane?1.0:driving?.25:.12;camera.position.lerp(desired,1-Math.exp(-16*dt));camera.lookAt(desired.clone().add(new THREE.Vector3(-Math.sin(orbit)*10,-Math.sin(pitch)*10,-Math.cos(orbit)*10)));characters[character].mesh.visible=!!driving&&!drivingPlane;return;}
 characters[character].mesh.visible=!drivingPlane;
 desired.copy(look).add(new THREE.Vector3(Math.sin(orbit)*camDistance*Math.cos(pitch),camDistance*Math.sin(pitch)+.5,Math.cos(orbit)*camDistance*Math.cos(pitch)));
 const dir=desired.clone().sub(look),dist=dir.length();ray.set(look,dir.normalize());ray.far=dist;let closest=dist;{const dn=dir.clone().normalize(),t=world.collision.rayDistance(look.x,look.y,look.z,dn.x,dn.y,dn.z,dist,.5,['building','wall']);if(t<closest)closest=t-.35;}desired.copy(look).addScaledVector(dir,Math.max(1,closest));desired.y=Math.max(terrainHeight(desired.x,desired.z)+.6,desired.y);camera.position.lerp(desired,1-Math.exp(-7*dt));camera.lookAt(look);
}
let uiTimer=0;
function updateUI(dt){uiTimer+=dt;if(uiTimer<.1)return;uiTimer=0;const p=activePosition();$('#speed').textContent=Math.round(currentSpeed*3.6);$('#travelMode').textContent=driving?driving.spec.name:'ON FOOT';$('#district').textContent=nearestRoad(p.x,p.z).road.name;const angle=((orbit*180/Math.PI)%360+360)%360;$('#heading').textContent=['S','SW','W','NW','N','NE','E','SE'][Math.round(angle/45)%8];drawMap($('#minimap'));if($('#fullMap').open)drawMap($('#largeMap'),true);updateMission();
 const nearPlane=driving||drivingPlane?null:nearestPlane(),near=driving||drivingPlane?null:nearestVehicle(),npc=!driving&&!drivingPlane&&world.npcs.find(n=>n.mesh.position.distanceTo(player.position)<3.5),jobSite=!driving&&!drivingPlane?nearestJobSite():null;
 const jobText=job&&job.kind==='counter'&&customerWaiting&&jobSite===job.site?'<kbd>F</kbd> Serve customer (+₹'+job.pay+')':jobSite?(job&&job.site===jobSite?'<kbd>F</kbd> Clock out ('+job.role+')':'<kbd>F</kbd> Work here — '+jobSite.role):'';
 const teaPrompt=interiors.active?(interiors.nearCounter(player.position)?'<kbd>E</kbd> Buy Tea — ₹10 · see the menu':interiors.nearDoor(player.position)?'<kbd>E</kbd> Exit the shop':''):(teaShopNearby()?'<kbd>E</kbd> Enter chaya kada':'');
 const text=teaPrompt||jobText||(drivingPlane?(planeSpeed<5&&startupPlane.position.y<=terrainHeight(startupPlane.position.x,startupPlane.position.z)+2.5?'<kbd>E</kbd> Exit plane · <kbd>W</kbd> Throttle · <kbd>Space</kbd> Climb · <kbd>Ctrl</kbd> Descend':'Land and slow to exit'):driving?(Math.abs(driving.speed)<1.2?'<kbd>E</kbd> Exit vehicle':''):nearPlane?'<kbd>E</kbd> Fly Mugeena':near?'<kbd>E</kbd> Drive '+near.spec.name:npc?'<kbd>F</kbd> Talk to '+npc.name:'');$('#prompt').hidden=!text;$('#prompt').innerHTML=text;
 $('#jobRole').textContent=job?job.role:'Unemployed';$('#jobMoney').textContent='₹'+money;
 if(performance.now()>toastUntil)$('#toast').hidden=true;
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);}window.addEventListener('resize',resize);
setQuality('medium');setWeather('sun');
// Load authored GLBs only when supplied in the manifest; failures leave playable fallbacks.
loadModelManifest().then(async m=>{manifest=m;for(const key of ['male','female'])try{externalCharacters[key]=await mountModel(m.characters?.[key],characters[key].mesh,characters[key].visual,1.93);}catch(e){console.warn('Character fallback retained:',e);toast('A custom character could not load; the built-in model is active.');}
 for(const v of world.parked)if(m.vehicles?.[v.kind])try{const model=await mountModel(m.vehicles[v.kind],v.mesh,v.visual,Math.max(1.6,v.kind.includes('bus')?3:1.6));externalVehicles.set(v,model);}catch(e){console.warn('Vehicle fallback retained:',v.kind,e);}
 for(const n of world.npcs)if(m.npcs?.[n.role])try{externalNpcs.set(n,await mountModel(m.npcs[n.role],n.mesh,n.visual,1.93));}catch(e){console.warn('NPC fallback retained:',e);}
}).catch(e=>console.warn(e));
// Start the clock from the first animation timestamp, after world construction.
let previous=null;
function frame(now){requestAnimationFrame(frame);const rawDt=previous===null?0:Math.max(0,(now-previous)/1000),dt=Math.min(rawDt,.05);previous=now;elapsed+=paused&&started?0:dt;
 if(!paused){updatePlayer(dt);updateTraffic(dt);updateRemotePlayers(dt);updateJob(dt);}else{updateRemotePlayers(dt);}if(!drivingPlane)updatePlane(dt);updateLights(dt);updateCamera(dt);updateUI(dt);if(quality==='high')composer.render(dt);else renderer.render(scene,camera);
 frameCount++;frameTime+=rawDt;if(frameTime>1){$('#telemetry').textContent=Math.round(frameCount/frameTime)+' FPS · '+quality.toUpperCase();frameCount=0;frameTime=0;}
}
updateUI(.2);requestAnimationFrame(frame);
document.addEventListener('pointerdown',()=>{if(!started)startMusic();},{passive:true});
startMusic();
$('#playerName').value=playerName;
$('#genderSelect').value=playerGender;
$('#play').disabled=false;$('#play').textContent='Enter Kurukkanmoola X →';
setInterval(()=>{if(started){syncOnline();}else{startMusic();}},1000);
setInterval(()=>{if($('#leaderboard').open)refreshLeaderboard();},3000);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;toast('Graphics context lost. Reload the page to restart.');});
// Opt-in inspection hook used by the included smoke test, absent in normal play.
if(new URLSearchParams(location.search).has('debug'))window.__PERUNNA__={enterTeaShop,exitTeaShop,openTeaMenu,buyItem,interiors,spendMoney,getMoney:()=>money,setMoney:v=>{money=v;},teaShopNearby,renderer,scene,camera,player,world,terrainHeight,groundHeight,waterLevelAt,get driving(){return driving;},get drivingPlane(){return drivingPlane},get startupPlane(){return startupPlane},get paused(){return paused;},blocked,vehicleBlocked,setWeather,enterExit,get visited(){return [...visited];},setQuality,updateUI,updateMission,uiState(){return {pos:activePosition().toArray(),uiTimer,waypoint};},teleport(x,z,yaw=0){driving=null;drivingPlane=null;player.visible=true;player.position.set(x,terrainHeight(x,z)+.18,z);player.rotation.y=yaw;orbit=yaw;verticalSpeed=0;camera.position.copy(player.position).add(new THREE.Vector3(Math.sin(yaw)*6.5,3,Math.cos(yaw)*6.5));updateLights(.01);updateCamera(1);updateUI(.2);renderer.render(scene,camera);},step(dt){elapsed+=dt;updatePlayer(dt);updateTraffic(dt);updateUI(.2);updateLights(dt);updateCamera(dt);},get missionIndex(){return missionIndex;}};
