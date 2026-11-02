// Kurukkanmoola X master-world coordinates. 1 unit = 1 metre.
import {townNetwork,outerLoopPoints} from './town-plan.js';
export const WORLD_WIDTH=12000, WORLD_HEIGHT=8300;
export const WORLD_BOUNDS={west:-6000,east:6000,south:-4150,north:4150};
export const PLAYER_SPAWN={x:0,z:650}; // fixed startup location for every new load
const SPAWN_CLEAR_RADIUS=110;
export const landmarks=[
 {name:'Kurukkanmoola Town Center',x:0,z:0,kind:'town',description:'The main town hub and central roundabout'},
 {name:'Kannadikal Hills',x:-4000,z:3000,kind:'mountain',description:'High mountain roads, viewpoints and forest'},
 {name:'Churuli Scenic Hill Station',x:-3900,z:2500,kind:'mountain',description:'Hill station with resorts and winding roads'},
 {name:'Churuli View Point',x:-4400,z:2850,kind:'view',description:'Mountain viewpoint above the tea country'},
 {name:'Tea Plantations',x:-3900,z:1100,kind:'tea',description:'Rolling tea fields and plantation roads'},
 {name:'Kannadikal Dam',x:1600,z:2240,kind:'dam',description:'Large reservoir, spillway and dam road'},
 {name:'Eco Park',x:2600,z:2100,kind:'park',description:'Green recreation zone beside the reservoir'},
 {name:'N.S.S. Hindu College',x:850,z:-250,kind:'college',description:'Large college campus and sports ground'},
 {name:'Sree Subrahmanya Swami Temple',x:650,z:-900,kind:'temple',description:'Major temple district'},
 {name:'Vellat Bhagavathy Temple',x:-850,z:-850,kind:'temple',description:'Temple courtyard and cultural complex'},
 {name:'Sree Valsantha Santhimangalam',x:-1050,z:500,kind:'temple',description:'Spiritual and cultural complex'},
 {name:'Sunset View Point',x:800,z:-1900,kind:'view',description:'Meeting point overlooking the backwaters'},
 {name:'Kurinji Falls',x:-5000,z:-3000,kind:'waterfall',description:'Forest waterfall and hiking destination'},
 {name:'Forest Trail',x:-3600,z:-1300,kind:'trail',description:'Dense forest exploration route'},
 {name:'Kurukkanmoola Backwaters',x:3680,z:-1850,kind:'water',description:'Large southern backwater and island network'},
 {name:'Contour Backwaters',x:-1050,z:-950,kind:'hotel',description:'Riverside resort and jetty district'},
 {name:'Greenview Mini Resort',x:-1300,z:-450,kind:'hotel',description:'Riverside resort'},
 {name:'Hotel Aryaas',x:420,z:-180,kind:'cafe',description:'Busy town hotel and restaurant'},
 {name:'Padma Cafe Kurukkanmoola',x:520,z:180,kind:'cafe',description:'Town cafe near the market'},
 {name:'Calicut Chef Restaurant',x:760,z:260,kind:'cafe',description:'Town restaurant'},
 {name:'Paddy Fields',x:-1800,z:-1900,kind:'farm',description:'Agricultural lowlands and irrigation channels'}
];

// Shared by terrain, rendered roads, water, the map, and traversal tests.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export function project(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return {t,d:Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)};}
export const segmentDistance=(x,z,a,b)=>project(x,z,a,b).d;
export const watercourses=[
 {name:'Reservoir outlet',width:110,points:[[1600,2240,120],[1600,2100,76],[850,1900,75],[-900,1700,74],[-2200,1500,74]]},
 {name:'Western River',width:150,points:[[-2650,3950,119],[-2580,3150,106],[-2440,2300,88],[-2200,1500,74],[-2100,700,71],[-1800,-100,67],[-1500,-1050,57],[-800,-1850,40],[-300,-2600,24],[700,-3150,12],[1900,-3480,7],[3400,-3550,6]]},
 {name:'Town Canal',width:42,points:[[-2100,700,71],[-1300,620,70],[-750,450,69],[-430,-250,67],[700,-550,64],[1700,-1150,39],[2600,-1500,13],[3200,-1800,8]]},
 {name:'Kurinji River',width:52,points:[[-5580,-2450,304],[-5200,-2800,296],[-5000,-2990,292],[-5000,-3010,205],[-4400,-3350,150],[-3400,-3540,75],[-1800,-3740,26],[600,-3700,7],[2800,-3700,6]]}
];
export const lakes=[{name:'Reservoir',cx:1600,cz:3050,rx:1150,rz:815,level:120},{name:'Backwaters',cx:3800,cz:-2170,rx:1950,rz:1050,level:8},{name:'Eastern lagoons',cx:5010,cz:-1180,rx:700,rz:620,level:8},{name:'Southern water',cx:2900,cz:-3830,rx:2880,rz:470,level:6}];
export const islands=[{x:3680,z:-1850,rx:255,rz:200},{x:4450,z:-2440,rx:230,rz:180},{x:3000,z:-2730,rx:210,rz:135},{x:5140,z:-3000,rx:280,rz:220},{x:2450,z:-2280,rx:190,rz:155}];
function ellipseDistance(x,z,l){return (Math.hypot((x-l.cx)/l.rx,(z-l.cz)/l.rz)-1)*Math.min(l.rx,l.rz);}
export function waterInfo(x,z){let d=Infinity,level=0,name='';for(const l of lakes){const v=ellipseDistance(x,z,l);if(v<d){d=v;level=l.level;name=l.name;}}
 for(const river of watercourses)for(let i=1;i<river.points.length;i++){const a=river.points[i-1],b=river.points[i],p=project(x,z,a,b),v=p.d-river.width/2;if(v<d){d=v;level=mix(a[2],b[2],p.t);name=river.name;}}
 for(const i of islands){const v=(1-Math.hypot((x-i.x)/i.rx,(z-i.z)/i.rz))*Math.min(i.rx,i.rz);if(v>0&&d<0)d=v;}
 return {distance:d,level,name};}
export const isWater=(x,z)=>waterInfo(x,z).distance<0;
export const waterLevelAt=(x,z)=>waterInfo(x,z).level;
export const riverX=z=>-2600+220*Math.sin(z*.0008);
const knots=[[-5000,3300,720,1400],[-4400,3500,615,1600],[-3900,2500,450,1450],[-4400,2850,520,1100],[-3350,3300,540,1350],[-3900,1100,285,1450],[-5000,-2950,315,1150]];
function landBase(x,z){let h=85;const south=smooth(600,3450,-z),east=smooth(1400,4200,x);h=mix(h,15,Math.max(south*.75,east*smooth(200,1800,-z)));
 for(const [cx,cz,peak,r] of knots){const d=Math.hypot((x-cx)/r,(z-cz)/r);h=Math.max(h,85+(peak-85)*Math.exp(-d*d*1.7));}
 const outskirts=smooth(950,2400,Math.hypot(x,z));const noise=Math.sin(x*.007)*Math.cos(z*.005)*6+Math.sin(x*.019+z*.009)*2.2;h+=noise*outskirts;
 const w=waterInfo(x,z);if(w.distance<480){const bank=h+(Math.max(h,w.level+9)-h)*(1-smooth(160,480,w.distance));if(w.distance<0)h=w.level-Math.min(7,Math.max(.11*-w.distance,7*smooth(0,40,-w.distance)));else{const old=mix(w.level,bank,smooth(0,150,w.distance));h=Math.max(old,Math.min(w.level+.11*w.distance,w.level+1.8));}}
 for(const i of islands){const q=Math.hypot((x-i.x)/i.rx,(z-i.z)/i.rz);if(q<1.2)h=Math.max(h,8+12*Math.pow(Math.max(0,1-q*q/1.44),1.2));}
 // A real bedrock waterfall lip, not a floating tower.
 if(Math.abs(x+5000)<125&&z>-3135&&z<-2940){const blend=1-smooth(70,125,Math.abs(x+5000));const level=z>-2990?292:z<-3010?205:mix(205,292,(z+3010)/20);h=mix(h,Math.min(h,level-9),blend);}
 if(z<-3020&&z>-3240&&Math.abs(x+5000)<200){const t=(1-smooth(80,200,Math.abs(x+5000)))*(1-smooth(180,220,-z-3020));h=mix(h,Math.min(h,208),t);}
 return clamp(h,-10,720);
}
const list=[];let chainCounter=0;
function road(points,width,name,type='primary',grade=.14){const chain=chainCounter++;
 // Densify curves and assign a continuous, slope-limited vertical profile.
 const dense=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/24);for(let j=0;j<n;j++)dense.push([mix(a[0],b[0],j/n),mix(a[1],b[1],j/n)]);}dense.push(points.at(-1));
 const heights=dense.map(p=>{const w=waterInfo(...p);return Math.max(landBase(...p),w.distance<width+8?w.level+5:-100);});
 // Raising low points in both directions creates continuous approach ramps.
 for(let i=1;i<dense.length;i++)heights[i]=Math.max(heights[i],heights[i-1]-Math.hypot(dense[i][0]-dense[i-1][0],dense[i][1]-dense[i-1][1])*grade);
 for(let i=dense.length-2;i>=0;i--)heights[i]=Math.max(heights[i],heights[i+1]-Math.hypot(dense[i][0]-dense[i+1][0],dense[i][1]-dense[i+1][1])*grade);
 for(let i=1;i<dense.length;i++)list.push({a:dense[i-1],b:dense[i],ya:heights[i-1],yb:heights[i],width,name,type,grade,chain,ci:i-1});
}
road([[0,0],[-600,280],[-1320,700],[-2050,1320],[-2800,1800],[-3200,1650],[-3500,1800],[-3200,1990],[-2950,2150],[-3200,2300],[-3900,2500]],8,'Mountain Road');
road([[-3900,2500],[-4400,2570],[-4620,2690],[-4440,2820],[-3700,2910],[-3560,3020],[-3730,3130],[-4650,3190],[-4850,3310],[-4600,3420],[-3850,3460],[-3740,3570],[-3950,3690],[-4730,3720],[-4920,3610],[-4780,3490],[-4300,3380],[-4000,3000]],7,'Kannadikal Switchback','hill',.14);
road([[-4440,2820],[-4400,2850]],4.8,'Churuli View Road','hill',.18);
road([[0,0],[350,650],[800,1350],[1150,2050],[1275,2240],[1600,2240],[1925,2240],[2300,2110],[2750,2700],[2900,3600],[4700,3700],[5700,3900]],11,'Dam Road','highway',.12);
road([[0,0],[900,50],[1800,0],[2800,-350],[3700,-650],[4600,-500],[5600,400]],12,'East Highway','highway',.12);
road([[0,0],[350,-500],[700,-1050],[800,-1900],[1400,-2300],[2400,-3000],[3600,-3300],[4450,-3200],[5300,-3200]],8,'South Backwater Road');
road([[0,0],[-500,-250],[-850,-850],[-1400,-1150],[-2200,-1350],[-3000,-1700],[-3800,-2200],[-4500,-2600],[-4900,-2890]],7,'West River Road');
road([[-4900,-2890],[-4820,-3020],[-4700,-3170]],2,'Falls Walking Trail','trail',.18);
road([[-2800,1800],[-3500,1650],[-4300,1500],[-4800,1100],[-4200,800],[-3400,600],[-3200,1100],[-3500,1650]],5,'Tea Plantation Road','secondary');
road([[-3000,-1700],[-3600,-1300],[-4200,-1000],[-4900,-800]],3,'Forest Trail Road','forest',.18);
road([[800,-1900],[1800,-1750],[2400,-1700],[3000,-1700],[3680,-1850],[4230,-1730],[4780,-1570],[5600,-500]],7,'Backwater Ring Road');
road([[3680,-1850],[3920,-2190],[4450,-2440],[4850,-2760],[5140,-3000],[5300,-3200]],5.5,'Island Road','secondary');
road([[-850,-850],[-300,-1000],[650,-1050],[950,-850]],6,'Temple District Road','secondary');
road([[0,0],[500,-150],[850,-250],[1400,-370],[2200,-400]],8,'College Road');
road([[-2200,-1350],[-2300,-1900],[-1700,-2080],[-1000,-2200],[-300,-2300],[800,-1900]],5.5,'Agriculture Road','secondary');
road([[0,0],[0,700],[0,1450]],6,'North Town Road','secondary');
// Organic town network (replaces the perfectly regular 260 m x 250 m lattice): a bazaar ring road, an outer loop and procedurally
// grown curved streets that meet in T-junctions or end in lanes. Deterministic (seeded), see town-plan.js.
export const townKeepClear=[{x:78,z:520,r:26},{x:0,z:0,r:64},{x:850,z:-145,r:62},{x:950,z:-130,r:62},{x:1030,z:80,r:78},{x:440,z:-120,r:30},{x:600,z:-150,r:30},{x:650,z:-815,r:50},{x:-850,z:-745,r:52},{x:-1050,z:580,r:46}];
const loopPts=outerLoopPoints((x,z)=>waterInfo(x,z).distance>40);
for(const o of townNetwork({waterInfo,landBase,segs:list.slice(),keepClear:townKeepClear,outerLoop:loopPts,seed:4471}))road(o.points,o.width,o.name,o.type);
// Branching residential lanes and farm/forest access tracks, rooted on the outer loop.
for(let i=0;i<16;i++){const a=i/16*Math.PI*2,c=Math.cos(a),s=Math.sin(a);road([loopPts[i],[c*1550+80,s*1250],[c*2150,s*1700]],4.6,'Village Lane','residential');}
// Reconcile shared junctions, then propagate grade constraints through the graph.
const nodes=new Map();function node(p,h){const key=p.map(v=>v.toFixed(4)).join(':');if(!nodes.has(key))nodes.set(key,{height:h,edges:[]});const n=nodes.get(key);n.height=Math.max(n.height,h);return n;}
for(const r of list){r.na=node(r.a,r.ya);r.nb=node(r.b,r.yb);const drop=Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])*r.grade;r.na.edges.push([r.nb,drop]);r.nb.edges.push([r.na,drop]);}
const queue=[...nodes.values()];for(let i=0;i<queue.length;i++){const n=queue[i];for(const [other,drop] of n.edges)if(other.height<n.height-drop-.000001){other.height=n.height-drop;queue.push(other);}}
for(const r of list){r.ya=r.na.height;r.yb=r.nb.height;delete r.na;delete r.nb;}
export const roads=list;
// Continuous polylines (one per road() call) with final heights: used for ribbons, junction detection and traffic.
export const roadChains=(()=>{const m=new Map();for(const r of list){let c=m.get(r.chain);if(!c){c={id:r.chain,name:r.name,type:r.type,width:r.width,pts:[r.a],ys:[r.ya]};m.set(r.chain,c);}c.pts.push(r.b);c.ys.push(r.yb);}return [...m.values()];})();
const buckets=new Map(),bucketSize=160;
for(const r of roads){for(let iz=Math.floor((Math.min(r.a[1],r.b[1])-160)/bucketSize);iz<=Math.floor((Math.max(r.a[1],r.b[1])+160)/bucketSize);iz++)for(let ix=Math.floor((Math.min(r.a[0],r.b[0])-160)/bucketSize);ix<=Math.floor((Math.max(r.a[0],r.b[0])+160)/bucketSize);ix++){const key=ix+':'+iz;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}}
export function nearestRoad(x,z,localOnly=false){let found=roads[0],distance=Infinity,t=0;const local=buckets.get(Math.floor(x/bucketSize)+':'+Math.floor(z/bucketSize));for(const r of local|| (localOnly?[]:roads)){const p=project(x,z,r.a,r.b);if(p.d<distance){found=r;distance=p.d;t=p.t;}}return {road:found,distance,t,height:mix(found.ya,found.yb,t)};}
function heightAtVertex(x,z){let h=landBase(x,z);const r=nearestRoad(x,z,true),w=waterInfo(x,z);const blend=Math.min(140,24+Math.abs(r.height-h)*.9);if(r.distance<r.road.width/2+blend&&w.distance>0)h=mix(r.height,h,smooth(r.road.width/2+3,r.road.width/2+blend,r.distance));return h;}
// Exactly the same triangle interpolation is used by collision and terrain mesh.
export const TERRAIN_STEP=25,NX=480,NZ=332;
export const heights=new Float32Array((NX+1)*(NZ+1));
for(let iz=0;iz<=NZ;iz++)for(let ix=0;ix<=NX;ix++)heights[iz*(NX+1)+ix]=heightAtVertex(-6000+ix*TERRAIN_STEP,-4150+iz*TERRAIN_STEP);
export function terrainHeight(x,z){const u=clamp((x+6000)/25,0,NX-.000001),v=clamp((z+4150)/25,0,NZ-.000001),ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz,k=iz*(NX+1)+ix;const a=heights[k],b=heights[k+1],c=heights[k+NX+1],d=heights[k+NX+2];return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);}
export function surfaceHeight(x,z){const r=nearestRoad(x,z,true);return r.distance<=r.road.width/2+.4?Math.max(terrainHeight(x,z),r.height+.15):terrainHeight(x,z);}
export function forestZone(x,z){return (x<-2200&&(z<400||z>1700))||(z>2500&&x>2800)||(x>4900&&z>0);}
