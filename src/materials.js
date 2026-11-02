import * as THREE from 'three';
export let seed=4815;
export function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
export const range=(a,b)=>a+(b-a)*random();
export const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
export function noiseTexture(type,size=512){
 const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');
 const palettes={plaster:[189,180,151],asphalt:[69,73,71],soil:[119,94,63],grass:[72,92,43],roof:[128,67,43],wood:[89,63,41],paving:[154,146,125]};
 const base=palettes[type]||palettes.plaster;const d=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;const n=(random()-.5)*28+Math.sin(x*.018)*Math.cos(y*.034)*7;for(let k=0;k<3;k++)d.data[i+k]=base[k]+n;d.data[i+3]=255;}ctx.putImageData(d,0,0);
 if(type==='roof'){for(let y=0;y<size;y+=32){ctx.fillStyle='#25140b50';ctx.fillRect(0,y,size,4);for(let x=0;x<size;x+=24){ctx.fillStyle='#e59c6650';ctx.fillRect(x+(y/32%2)*12,y,3,31);ctx.fillStyle='#1c110b40';ctx.fillRect(x+18+(y/32%2)*12,y,3,31);}}}
 if(type==='paving'){ctx.strokeStyle='#49473888';ctx.lineWidth=2;for(let y=0;y<size;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y);ctx.stroke();for(let x=(y/32%2)*32;x<size;x+=64){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+32);ctx.stroke();}}}
 if(type==='wood'){ctx.globalAlpha=.18;for(let x=0;x<size;x+=4){ctx.strokeStyle=random()>.5?'#f9c582':'#120e08';ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+8,120,x-8,310,x,size);ctx.stroke();}}
 if(type==='asphalt'){ctx.strokeStyle='#272c2940';ctx.lineWidth=1;for(let i=0;i<10;i++){let x=range(0,size),y=range(0,size);ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<5;j++){x+=range(-30,30);y+=range(10,40);ctx.lineTo(x,y);}ctx.stroke();}}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;return texture;
}
export function textured(type,repeat=1){const map=noiseTexture(type);map.repeat.set(repeat,repeat);const bump=map.clone();bump.colorSpace=THREE.NoColorSpace;return new THREE.MeshStandardMaterial({map,bumpMap:bump,bumpScale:type==='roof'?.1:.035,roughness:.92});}
export const materials={
 plaster:textured('plaster',2),road:textured('asphalt',10),grass:textured('grass',50),soil:textured('soil',15),roof:textured('roof',3),wood:textured('wood',1),paving:textured('paving',7),
 white:mat('#d9d5c6'),cream:mat('#c2b398'),stone:mat('#777967'),black:mat('#1d2423'),steel:mat('#8d9995',.3,.85),gold:mat('#ad843f',.33,.75),rubber:mat('#141b1b',.96),glass:new THREE.MeshStandardMaterial({color:'#3b6466',metalness:.35,roughness:.24}),
 leaf:mat('#395e2c',.88),leafLight:mat('#647e38',.87),trunk:mat('#746547'),mark:mat('#cdc7a7'),red:mat('#9e352c'),blue:mat('#417375'),lamp:new THREE.MeshStandardMaterial({color:'#ffe1a1',emissive:'#ffc16a',emissiveIntensity:.6})
};
export function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const cube=new THREE.BoxGeometry(1,1,1);
export function box(parent,w,h,d,x,y,z,material=materials.plaster){const m=mesh(cube,material,parent,x,y,z);m.scale.set(w,h,d);return m;}
export function cylinder(parent,r1,r2,h,x,y,z,material=materials.steel,segments=12){return mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material,parent,x,y,z);}
export function sphere(parent,x,y,z,sx,sy,sz,material){const m=mesh(new THREE.SphereGeometry(1,16,12),material,parent,x,y,z);m.scale.set(sx,sy,sz);return m;}
export function beam(parent,a,b,r,material=materials.steel){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const m=cylinder(parent,r,r,delta.length(),0,0,0,material,8);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
const signs=new Map();
export function sign(parent,text,w,h,x,y,z,bg='#143c39',fg='#f1e8cf'){
 const key=text+bg+fg;let material=signs.get(key);
 if(!material){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.strokeStyle=fg+'70';ctx.lineWidth=4;ctx.strokeRect(12,12,1000,232);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';const lines=text.split('\n');ctx.font=`600 ${lines.length>1?61:76}px Arial`;lines.forEach((s,i)=>ctx.fillText(s,512,128+(i-(lines.length-1)/2)*83,950));const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;material=new THREE.MeshStandardMaterial({map:tex,roughness:.7,emissive:'#ffffff',emissiveMap:tex,emissiveIntensity:.12});signs.set(key,material);}
 return mesh(new THREE.PlaneGeometry(w,h),material,parent,x,y,z);
}
export function roof(parent,w,d,y,x=0,z=0){
 // Four-sided hipped roof with an elongated ridge and deep eaves.
 const rise=Math.min(w,d)*.24,a=w/2+.55,b=d/2+.55,ridge=Math.max(0,a-b*.65);
 const v=[-a,y,-b,a,y,-b,ridge,y+rise,0,-ridge,y+rise,0, a,y,-b,a,y,b,ridge,y+rise,0, a,y,b,-a,y,b,-ridge,y+rise,0,ridge,y+rise,0, -a,y,b,-a,y,-b,-ridge,y+rise,0];
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geom.setIndex([0,2,1,0,3,2,4,6,5,7,9,8,7,10,9,11,13,12]);const uv=[];for(let i=0;i<v.length;i+=3)uv.push(v[i]/w,v[i+2]/d+v[i+1]/d);geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geom.computeVertexNormals();const m=mesh(geom,materials.roof,parent,x,0,z);m.material.side=THREE.DoubleSide;box(parent,w+1.1,.16,d+1.1,x,y-.06,z,materials.wood);return m;
}

// Locally bundled, CC0 photo-derived PBR textures. Color maps use sRGB;
// normal and roughness maps remain linear data.
export async function loadPBR(renderer){
 const loader=new THREE.TextureLoader();const sets={road:'asphalt',grass:'grass',plaster:'plaster',roof:'roof',paving:'paving',wood:'wood'};
 const anisotropy=Math.min(2,renderer.capabilities.getMaxAnisotropy());
 await Promise.all(Object.entries(sets).map(async([key,name])=>{
  const [color,normal,roughness]=await Promise.all(['Diffuse','nor_gl','Rough'].map(s=>loader.loadAsync('./assets/textures/'+name+'-'+s+'.jpg')));
  const repeat=materials[key].map.repeat.clone();if(key==='grass')repeat.set(180,180);if(key==='paving')repeat.set(1,1);
  for(const t of [color,normal,roughness]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.copy(repeat);t.anisotropy=anisotropy;}
  color.colorSpace=THREE.SRGBColorSpace;materials[key].map=color;materials[key].normalMap=normal;materials[key].roughnessMap=roughness;materials[key].bumpMap=null;materials[key].normalScale.setScalar(key==='road'?.55:key==='plaster'?.35:.8);materials[key].roughness=1;materials[key].needsUpdate=true;
 }));
 materials.grass.color.set('#679d85');materials.paving.userData.planarScale=.5;
 materials.glass.color.set('#668189');materials.glass.metalness=.82;materials.glass.roughness=.08;materials.glass.envMapIntensity=1.2;
}
function palmTexture(){
 const c=document.createElement('canvas');c.width=256;c.height=1024;const ctx=c.getContext('2d');
 const grad=ctx.createLinearGradient(0,0,256,0);grad.addColorStop(0,'#294c21');grad.addColorStop(.46,'#799742');grad.addColorStop(.52,'#9baa55');grad.addColorStop(1,'#305320');ctx.fillStyle=grad;
 for(let i=0;i<45;i++){const y=35+i*20;const width=Math.pow(Math.sin((y/1024)*Math.PI),.5)*123;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(128,y);ctx.bezierCurveTo(128+side*width*.28,y-12,128+side*width*.8,y-45,128+side*width,y-18);ctx.bezierCurveTo(128+side*width*.72,y+1,128+side*width*.35,y+5,128,y+12);ctx.fill();ctx.strokeStyle='#b6b57450';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(128,y+4);ctx.quadraticCurveTo(128+side*width*.65,y-6,128+side*width,y-18);ctx.stroke();}}
 ctx.strokeStyle='#7d8040';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(128,0);ctx.lineTo(128,1010);ctx.stroke();const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
materials.palmLeaf=new THREE.MeshStandardMaterial({map:palmTexture(),alphaTest:.4,side:THREE.DoubleSide,roughness:.85,color:'#bccf87'});
