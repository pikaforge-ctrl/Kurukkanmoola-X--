import * as THREE from 'three';
import {detailedHead,garment} from './people-detail.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {materials as M,mat,mesh,box,cylinder,sphere,beam,sign,roof} from './materials.js';
// Merge rigid parts while retaining wheel and limb transforms for animation.
function batchRigid(group,exclude=[]){
 group.updateMatrixWorld(true);const buckets=new Map(),remove=[];const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();
 function visit(o){if(exclude.includes(o))return;if(o.isMesh){let geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));for(const key of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(key))geo.deleteAttribute(key);if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));let b=buckets.get(o.material);if(!b){b=[];buckets.set(o.material,b);}b.push(geo);remove.push(o);}for(const c of o.children)visit(c);}
 for(const c of group.children)visit(c);
 for(const o of remove)o.removeFromParent();
 for(const [material,geos] of buckets){const geometry=mergeGeometries(geos,false);if(!geometry)throw new Error('Rigid part merge failed');mesh(geometry,material,group);geos.forEach(g=>g.dispose());}
}
export const vehicleTypes=[
 {id:'hatch',name:'Hatchback',color:'#d6dbd4',length:4.1,width:1.8,max:28},
 {id:'taxi',name:'Kerala taxi',color:'#e5e0cb',length:4.9,width:1.9,max:28},
 {id:'suv',name:'Touring SUV',color:'#293e47',length:4.9,width:2,max:31},
 {id:'jeep',name:'Country jeep',color:'#80735b',length:3.9,width:1.85,max:24},
 {id:'auto',name:'Auto rickshaw',color:'#e2aa22',length:2.8,width:1.5,max:17},
 {id:'bus',name:'KSRTC ordinary',color:'#c8362b',length:10,width:2.5,max:24},
 {id:'swift',name:'KSRTC Swift',color:'#b9322f',length:11,width:2.55,max:28},
 {id:'private',name:'Blue private bus',color:'#248dac',length:10,width:2.5,max:25},
 {id:'van',name:'Traveller van',color:'#dfdfd3',length:5.5,width:2,max:25},
 {id:'truck',name:'Goods lorry',color:'#b96432',length:8,width:2.5,max:22},
 {id:'mini',name:'Mini truck',color:'#ccaf64',length:4.3,width:1.8,max:20},
 {id:'load',name:'Produce carrier',color:'#cfb996',length:4.6,width:1.9,max:20},
 {id:'tractor',name:'Farm tractor',color:'#af3831',length:3.7,width:2,max:12},
 {id:'tanker',name:'Water tanker',color:'#d0a131',length:7,width:2.4,max:20},
 {id:'garbage',name:'Municipal truck',color:'#3b8957',length:7,width:2.4,max:20},
 {id:'bike',name:'Classic motorcycle',color:'#283532',length:2.2,width:.8,max:28},
 {id:'sport',name:'Sport motorcycle',color:'#d87625',length:2.15,width:.8,max:34},
 {id:'scooter',name:'Town scooter',color:'#d5d3bb',length:1.9,width:.8,max:21},
 {id:'moped',name:'Everyday moped',color:'#4f6965',length:1.85,width:.7,max:18},
 {id:'bicycle',name:'Roadster bicycle',color:'#343d33',length:1.85,width:.6,max:10},
 {id:'goodsauto',name:'Goods auto',color:'#d5a329',length:3.3,width:1.55,max:17}
];
function rounded(parent,w,h,d,x,y,z,material,r=.08){return mesh(new RoundedBoxGeometry(w,h,d,2,r),material,parent,x,y,z);}
function wheel(parent,x,z,r=.34,width=.22){const g=new THREE.Group();g.position.set(x,r,z);parent.add(g);const t=mesh(new THREE.CylinderGeometry(r,r,width,20),M.rubber,g);t.rotation.z=Math.PI/2;const rim=mesh(new THREE.CylinderGeometry(r*.59,r*.59,width+.018,16),M.steel,g);rim.rotation.z=Math.PI/2;for(let i=0;i<6;i++){const a=i*Math.PI/3;beam(g,[-width*.55,Math.sin(a)*r*.15,Math.cos(a)*r*.15],[-width*.55,Math.sin(a)*r*.54,Math.cos(a)*r*.54],.014,M.black);beam(g,[width*.55,Math.sin(a)*r*.15,Math.cos(a)*r*.15],[width*.55,Math.sin(a)*r*.54,Math.cos(a)*r*.54],.014,M.black);}return g;}
function quad(parent,points,material){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();material.side=THREE.DoubleSide;return mesh(geo,material,parent);}
function sculptedCar(parent,spec,paint){
 const L=spec.length,W=spec.width,tall=['suv','jeep'].includes(spec.id),top=tall?1.77:1.53;
 const sections=[[-.5,.78,.7],[-.46,.94,.81],[-.3,1,.87],[-.18,1,.92],[.22,1,.94],[.41,.96,.9],[.5,.83,.76]],positions=[],uv=[],indices=[];
 sections.forEach(([z,wide,high],j)=>{const ring=[[-.41*W*wide,.38],[-.5*W*wide,.57],[-.49*W*wide,high-.035],[-.4*W*wide,high],[.4*W*wide,high],[.49*W*wide,high-.035],[.5*W*wide,.57],[.41*W*wide,.38]];ring.forEach(([x,y],i)=>{positions.push(x,y,z*L);uv.push(i/7,j/6);});});
 for(let j=0;j<sections.length-1;j++)for(let i=0;i<8;i++){const a=j*8+i,b=j*8+(i+1)%8,c=(j+1)*8+i,d=(j+1)*8+(i+1)%8;indices.push(a,c,b,b,c,d);}for(const section of [0,sections.length-1]){const center=positions.length/3;positions.push(0,(.38+sections[section][2])*.5,sections[section][0]*L);uv.push(.5,.5);for(let i=0;i<8;i++)indices.push(center,section*8+i,section*8+(i+1)%8);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();paint.side=THREE.DoubleSide;mesh(geo,paint,parent);
 const lowFront=-L*.235,highFront=-L*.09,lowRear=L*.375,highRear=L*.24,lowWidth=W*.425,highWidth=W*.35;
 const lf=[-lowWidth,.92,lowFront],rf=[lowWidth,.92,lowFront],lb=[-lowWidth,.94,lowRear],rb=[lowWidth,.94,lowRear],tl=[-highWidth,top,highFront],tr=[highWidth,top,highFront],bl=[-highWidth,top,highRear],br=[highWidth,top,highRear];
 quad(parent,[lf,rf,tr,tl],M.glass);quad(parent,[lb,bl,br,rb],M.glass);quad(parent,[lf,tl,bl,lb],M.glass);quad(parent,[rf,rb,br,tr],M.glass);quad(parent,[tl,tr,br,bl],paint);
 for(const [a,b] of [[lf,tl],[rf,tr],[lb,bl],[rb,br],[tl,tr],[bl,br],[tl,bl],[tr,br]])beam(parent,a,b,.031,paint);
 for(const side of [-1,1]){beam(parent,[side*lowWidth,.94,L*.055],[side*highWidth,top,L*.055],.037,M.black);beam(parent,[side*lowWidth,.935,lowFront],[side*lowWidth,.955,lowRear],.015,M.steel);for(const z of [-L*.03,L*.25]){beam(parent,[side*W*.494,.87,z],[side*W*.489,.44,z],.004,M.black);box(parent,.032,.025,.16,side*W*.5,.84,z+.13,M.steel);}rounded(parent,.23,.13,.22,side*W*.54,1.04,lowFront+.13,paint,.04);}
 // Seats and steering wheel remain visible through the front glass at close range.
 for(const x of [-W*.22,W*.22]){rounded(parent,.44,.53,.22,x,1.0,.13,M.black,.07);rounded(parent,.39,.17,.5,x,.68,-.03,M.black,.04);}
 const steering=mesh(new THREE.TorusGeometry(.14,.018,6,16),M.black,parent,W*.22,1.02,-L*.13);steering.rotation.x=.65;
 for(const side of [-1,1])beam(parent,[side*.08,.945,lowFront-.025],[side*W*.32,1.0,lowFront+.04],.009,M.black);
 if(spec.id==='taxi'){box(parent,.55,.19,.28,0,top+.14,0,M.gold);sign(parent,'TAXI',.5,.16,0,top+.14,-.15,'#d5ac37','#172722').rotation.y=Math.PI;}
 if(spec.id==='suv')for(const side of [-1,1])beam(parent,[side*W*.3,top+.05,-L*.07],[side*W*.3,top+.05,L*.22],.024,M.steel);
 if(spec.id==='jeep')for(let i=-3;i<=3;i++)box(parent,.065,.28,.045,i*.16,.67,-L*.48,M.black);
}
export function createVehicle(type='hatch',color){
 const spec=vehicleTypes.find(v=>v.id===type)||vehicleTypes[0],g=new THREE.Group(),visual=new THREE.Group();g.add(visual);
 const paint=new THREE.MeshStandardMaterial({color:color||spec.color,metalness:.22,roughness:.32});
 const {length:L,width:W}=spec,wheels=[];const bus=['bus','swift','private'].includes(type),lorry=['truck','mini','load','tanker','garbage'].includes(type),two=['bike','sport','scooter','moped','bicycle'].includes(type),auto=['auto','goodsauto'].includes(type);
 if(two){
  const r=type==='bicycle'?.34:.29;wheels.push(wheel(visual,0,-L*.36,r,.1),wheel(visual,0,L*.36,r,.13));
  beam(visual,[0,.34,-L*.36],[0,.93,-L*.2],.035,M.steel);beam(visual,[0,.34,L*.36],[0,.68,0],.035,paint);beam(visual,[0,.68,0],[0,.34,-L*.36],.035,paint);beam(visual,[0,.68,0],[0,.85,L*.12],.035,paint);beam(visual,[0,.85,L*.12],[0,.34,L*.36],.03,M.steel);
  rounded(visual,.36,.11,.65,0,.88,L*.12,M.rubber,.04);beam(visual,[0,.92,-L*.2],[0,1.1,-L*.24],.03,M.steel);beam(visual,[-.34,1.1,-L*.24],[.34,1.1,-L*.24],.025,M.black);
  if(type!=='bicycle'){sphere(visual,0,.71,-.16,.24,.2,.33,paint);rounded(visual,.3,.32,.34,0,.4,.04,M.steel,.03);beam(visual,[.22,.32,.02],[.22,.29,.7],.06,M.steel);sphere(visual,0,.96,-.53,.11,.11,.04,M.lamp);}
  if(type==='sport'||type==='scooter')rounded(visual,.4,.5,.36,0,.6,-.48,paint,.12);
  if(type==='moped'||type==='bicycle')box(visual,.35,.22,.27,0,.99,-.52,M.black);
 }else if(auto){
  wheels.push(wheel(visual,0,-L*.34,.26,.15),wheel(visual,-W*.48,L*.28,.29),wheel(visual,W*.48,L*.28,.29));
  rounded(visual,W,.58,L,0,.64,0,paint,.1);rounded(visual,W,.17,L*.7,0,1.89,L*.07,M.black,.1);
  for(const x of [-W*.45,W*.45]){beam(visual,[x,.9,-L*.4],[x,1.85,-L*.23],.045,M.black);beam(visual,[x,.8,L*.4],[x,1.86,L*.4],.045,M.black);}
  const glass=box(visual,W*.85,.65,.045,0,1.42,-L*.34,M.glass);glass.rotation.x=-.2;rounded(visual,W*.8,.2,.6,0,1.03,L*.22,M.black);box(visual,W*.8,.4,.14,0,1.28,L*.41,M.black);
  if(type==='goodsauto'){box(visual,W,1.15,L*.52,0,1.23,L*.2,paint);for(let z=-.5;z<1.4;z+=.2)box(visual,W+.02,.85,.025,0,1.3,z,paint);}
 }else if(type==='tractor'){
  wheels.push(wheel(visual,-.81,-1.05,.38),wheel(visual,.81,-1.05,.38),wheel(visual,-.87,.91,.66,.4),wheel(visual,.87,.91,.66,.4));
  rounded(visual,1.15,.7,1.95,0,.95,-.4,paint);box(visual,1.6,.25,2.6,0,.56,0,M.black);box(visual,.62,.2,.6,0,1.23,.65,M.black);beam(visual,[0,1,-.1],[0,1.6,.1],.035,M.black);cylinder(visual,.06,.06,.95,.42,1.79,-.95,M.black);for(const x of [-.7,.7])beam(visual,[x,.8,1.2],[x,2.1,1.2],.045,M.black);box(visual,1.9,.12,1.8,0,2.15,.5,M.cream);
 }else if(bus||type==='van'){
  const H=bus?2.8:2.15,r=bus?.47:.36;rounded(visual,W,H-.5,L,0,H/2+.35,0,paint,.14);
  rounded(visual,W+.03,.16,L-.12,0,H+.19,0,M.cream,.08);box(visual,W+.035,.3,L+.015,0,.93,0,type==='bus'?M.red:M.white);
  box(visual,W*.86,1.05,.03,0,H-.48,-L/2-.015,M.glass);box(visual,W*.83,.74,.03,0,H-.43,L/2+.015,M.glass);
  for(let z=-L*.34;z<L*.42;z+=.95)for(const x of [-1,1]){box(visual,.025,.97,.81,x*(W/2+.012),H-.48,z,M.glass);box(visual,.04,.98,.035,x*(W/2+.03),H-.48,z,M.black);box(visual,.045,.035,.84,x*(W/2+.04),H-.57,z,M.steel);}
  sign(visual,type==='bus'?'KSRTC':type==='private'?'ANGEL':type==='swift'?'SWIFT':'TRAVELLER',W*.8,.35,0,H+.02,-L/2-.04,'#1c302d');visual.children.at(-1).rotation.y=Math.PI;
  for(const x of [-W/2,W/2])for(const z of [-L*.32,L*.32])wheels.push(wheel(visual,x,z,r,.25));
  for(const x of [-W*.58,W*.58]){beam(visual,[x*.84,H-.15,-L*.43],[x,H-.15,-L*.48],.035,M.black);box(visual,.12,.35,.2,x,H-.26,-L*.48,M.black);}
 }else if(lorry){
  const small=L<5,cy=small?1.17:1.5;box(visual,W*.8,.25,L,0,.53,0,M.black);rounded(visual,W,small?1.5:2,L*.31,0,cy,-L*.31,paint,.09);box(visual,W*.83,.6,.03,0,cy+.35,-L*.468,M.glass);
  for(const side of [-1,1])box(visual,.03,.6,L*.18,side*W*.505,cy+.32,-L*.31,M.glass);
  if(type==='tanker'){const tank=mesh(new THREE.CylinderGeometry(W*.47,W*.47,L*.59,20),paint,visual,0,1.67,L*.17);tank.rotation.x=Math.PI/2;for(const z of [-.8,.8,2]){const band=mesh(new THREE.TorusGeometry(W*.478,.045,6,24),M.steel,visual,0,1.67,z);}}
  else{box(visual,W,.2,L*.62,0,.9,L*.18,M.wood);for(const x of [-W*.49,W*.49])box(visual,.12,type==='garbage'?1.8:1.1,L*.61,x,type==='garbage'?1.8:1.48,L*.18,paint);box(visual,W,1.1,.12,0,1.48,L*.49,paint);if(type==='garbage')box(visual,W,1.8,L*.58,0,1.8,L*.18,paint);if(type==='load')for(let i=0;i<16;i++)sphere(visual,(i%4-1.5)*.35,1.2+Math.floor(i/8)*.3,.2+Math.floor(i/4)*.4,.22,.2,.23,M.leafLight);}
  for(const x of [-W*.49,W*.49])for(const z of [-L*.34,L*.32])wheels.push(wheel(visual,x,z,small?.34:.46,.26));
 }else{
  sculptedCar(visual,spec,paint);
  for(const x of [-W*.49,W*.49])for(const z of [-L*.31,L*.31])wheels.push(wheel(visual,x,z,type==='suv'?.38:.32));
 }
 if(!two){for(const side of [-1,1]){box(visual,W*.17,.15,.045,side*W*.33,.75,-L/2-.045,M.lamp);box(visual,W*.13,.15,.045,side*W*.34,.8,L/2+.03,M.red);}box(visual,W*.86,.13,.1,0,.44,-L/2-.045,M.black);box(visual,W*.86,.13,.1,0,.44,L/2+.045,M.black);const plate=sign(visual,'KL 05 2026',W*.4,.16,0,.63,-L/2-.075,'#d4bd7a','#162321');plate.rotation.y=Math.PI;}
 // Vehicle headlights use emissive lamp meshes instead of per-vehicle SpotLights.
 // Hundreds of disabled SpotLights still expand every Standard/Physical material shader.
 const lights=[];
 batchRigid(visual,wheels);wheels.forEach(w=>batchRigid(w));
 return {mesh:g,visual,wheels,lights,spec,speed:0,steer:0,radius:W*.57,length:L,kind:type};
}
export function createPerson(role='traveller',female=false){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);const skin=mat('#a57653',.78),hair=mat('#191d19',.92),shirt=mat(female?'#833e32':role==='traveller'?'#4a5641':role==='police'||role==='driver'?'#a79a71':role==='worker'?'#cf7138':role==='doctor'?'#e2e1d8':role==='student'?'#bdc5b8':role==='fisherman'?'#ddd7c1':'#637e77'),pants=mat(role==='police'?'#8d8262':role==='priest'?'#ded9c9':'#303b38');
 garment(body,[[.96,.17,.115],[1.02,.182,.13],[1.14,.19,.132],[1.3,.218,.137],[1.41,.232,.13],[1.47,.19,.115],[1.505,.078,.067]],shirt);sphere(body,0,.95,0,.185,.14,.125,pants);cylinder(body,.054,.065,.09,0,1.54,0,skin);detailedHead(body,skin,hair,female);
 const arms=[],legs=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.24,1.44,0);body.add(arm);garment(arm,[[-.035,.061,.067],[-.1,.075,.07],[-.2,.062,.061],[-.31,.05,.052]],shirt);sphere(arm,side*.035,-.4,0,.055,.12,.058,skin);sphere(arm,side*.035,-.53,-.01,.046,.073,.038,skin);arms.push(arm);
  const leg=new THREE.Group();leg.position.set(side*.105,.93,0);body.add(leg);garment(leg,[[0,.087,.086],[-.15,.085,.087],[-.35,.068,.072],[-.45,.061,.065],[-.6,.063,.067],[-.79,.046,.053]],pants);rounded(leg,.15,.105,.29,0,-.855,-.058,M.white,.04);box(leg,.154,.03,.29,0,-.9,-.059,M.black);for(let j=0;j<4;j++)beam(leg,[-.046,-.799,-.13+j*.035],[.046,-.799,-.13+j*.035],.004,M.black);legs.push(leg);
 }
 if(role==='traveller'){
  // White inner tee, jacket opening, canvas backpack, shoulder straps and pockets.
  if(!female){quad(body,[[-.082,1.465,-.15],[.082,1.465,-.15],[.079,1.035,-.145],[-.079,1.035,-.145]],M.white);for(const side of [-1,1])beam(body,[side*.092,1.46,-.16],[side*.084,1.045,-.155],.013,shirt);}else{beam(body,[0,1.46,-.149],[0,1.03,-.149],.003,M.steel);}rounded(body,.35,.44,.17,0,1.29,.204,M.black,.065);rounded(body,.25,.18,.06,0,1.19,.303,mat('#40443a'),.03);box(body,.055,.045,.013,0,1.4,.301,M.cream);
  for(const side of [-1,1]){beam(body,[side*.16,1.5,-.1],[side*.16,1.1,-.135],.022,M.black);beam(body,[side*.16,1.5,-.1],[side*.14,1.49,.23],.022,M.black);}
  // Hair is part of the detailed head.
 }
 if(['police','driver'].includes(role)){cylinder(body,.142,.142,.075,0,1.833,0,shirt,16);box(body,.19,.023,.13,0,1.813,-.1,shirt);box(body,.035,.05,.013,-.105,1.36,-.142,M.gold);box(body,.4,.035,.29,0,1.0,0,M.black);}
 if(role==='worker'){sphere(body,0,1.83,0,.151,.071,.145,M.gold);for(const x of [-.12,.12])box(body,.035,.35,.013,x,1.25,-.135,M.white);}
 if(role==='priest'){const dhoti=cylinder(body,.2,.29,.75,0,.56,0,M.white,18);}
 if(role==='fisherman'){cylinder(body,.21,.24,.47,0,.71,0,mat('#557c8b'),16);}
 batchRigid(body,[...arms,...legs]);arms.forEach(a=>batchRigid(a));legs.forEach(l=>batchRigid(l));
 const animate=(speed,time)=>{const amplitude=Math.min(speed/4,1)*.6;legs[0].rotation.x=Math.sin(time*8)*amplitude;legs[1].rotation.x=-legs[0].rotation.x;arms[0].rotation.x=-legs[0].rotation.x*.75;arms[1].rotation.x=-legs[1].rotation.x*.75;body.position.y=Math.abs(Math.sin(time*8))*amplitude*.035;};
 return {mesh:root,visual:body,arms,legs,animate,role};
}
function aircraftLabelTexture(text){
 const c=document.createElement('canvas'); c.width=512; c.height=96; const ctx=c.getContext('2d');
 ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle='rgba(255,255,255,0)'; ctx.fillRect(0,0,c.width,c.height);
 ctx.fillStyle='#b51f2a'; ctx.font='900 52px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
 ctx.fillText(text,256,48); const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.needsUpdate=true; return tex;
}
export function createAircraft(name='Mugeena'){
 const g=new THREE.Group(), body= new THREE.Group(); g.add(body);
 const white=mat('#f2f0e8',.55,.35), accent=mat('#c92531',.5,.4), dark=mat('#28323a',.7,.25), glass=mat('#4d6d7f',.2,.15), black=mat('#101416',.82,.15);
 // Compact single-engine high-wing aircraft, about 8 m long.
 rounded(body,1.12,.9,5.8,0,1.02,0,white,.18);
 rounded(body,.86,.48,1.7,0,1.42,-1.55,glass,.12);
 box(body,1.2,.18,1.05,0,1.47,-2.35,accent);
 // Main wings.
 box(body,5.9,.16,.72,0,1.33,.05,white);
 box(body,6.0,.12,.28,0,1.24,.18,accent);
 // Tailplane and vertical tail.
 box(body,2.6,.13,.54,0,1.54,2.2,white);
 const tail=box(body,.14,1.55,.72,0,1.85,2.28,white);
 tail.rotation.x=-.08;
 // Engine nacelle and propeller at nose.
 rounded(body,.56,.52,.9,0,1.08,-3.0,dark,.12);
 const prop= new THREE.Group(); prop.position.set(0,1.08,-3.48); body.add(prop);
 for(const a of [0,Math.PI/2]){
   const blade=box(prop,.12,.06,1.45,0,0,0,black); blade.rotation.z=a;
 }
 cylinder(prop,.09,.09,.18,0,0,0,black,12).rotation.x=Math.PI/2;
 // Landing gear silhouette for a more believable small aircraft.
 for(const x of [-.52,.52]){cylinder(body,.055,.055,.72,x,.62,-1.9,black,8).rotation.z=.15*x; rounded(body,.12,.06,.28,x,.26,-2.02,black,.03);}
 cylinder(body,.05,.05,.62,0,.6,2.15,black,8).rotation.z=.02;
 rounded(body,.11,.055,.24,0,.3,2.18,black,.03);
 // "Mugeena" name on both fuselage sides.
 const tex=aircraftLabelTexture(name);
 for(const side of [-1,1]){
   const panel=new THREE.Mesh(new THREE.PlaneGeometry(2.55,.42),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.FrontSide,depthWrite:false}));
   panel.position.set(side*.57,1.22,-.25); panel.rotation.y=side>0?Math.PI/2:-Math.PI/2; body.add(panel);
 }
 g.userData.flightPhase=Math.random()*Math.PI*2; g.userData.home=new THREE.Vector3(); g.userData.baseAltitude=24;
 return g;
}

export function createBoat(){const g=new THREE.Group();const hull=sphere(g,0,.1,0,2.1,.58,6.7,M.wood);box(g,3.8,.14,10.8,0,.43,0,M.wood);rounded(g,3.5,1.65,7.8,0,1.35,.3,M.cream,.35);for(const x of [-1.76,1.76])for(let z=-2.7;z<3.4;z+=1.35)box(g,.025,.85,.9,x,1.55,z,M.glass);roof(g,4.1,8.6,2.15,0,.3);for(const x of [-1.8,1.8])for(const z of [-4.6,-3.5])beam(g,[x,.48,z],[x,1.35,z],.045,M.wood);return g;}
