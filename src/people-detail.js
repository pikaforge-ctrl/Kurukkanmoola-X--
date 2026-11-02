import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mesh,sphere,beam,mat,materials as M} from './materials.js';
let headGeometry,hairGeometry;
export async function initializePeople(){
 const gltf=await new GLTFLoader().loadAsync('./assets/models/traveller-head.glb');gltf.scene.traverse(o=>{if(o.isMesh&&!headGeometry)headGeometry=o.geometry;});if(!headGeometry)throw new Error('Head model contains no mesh');
 const source=headGeometry.toNonIndexed(),p=source.attributes.position,n=source.attributes.normal,verts=[],norms=[];
 for(let i=0;i<p.count;i+=3){let keep=true;for(let j=0;j<3;j++){const y=p.getY(i+j),z=p.getZ(i+j);if(y<(z<-.08?1.855:z<-.02?1.815:1.735))keep=false;}if(!keep)continue;
  for(let j=0;j<3;j++){verts.push(p.getX(i+j)*1.04,p.getY(i+j)+.011,p.getZ(i+j)*1.04);norms.push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));}}
 hairGeometry=new THREE.BufferGeometry();hairGeometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));hairGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(norms,3));source.dispose();
}
function skinMaterial(skin){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const d=ctx.createImageData(128,128);for(let i=0;i<d.data.length;i+=4){const v=180+Math.random()*50;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}ctx.putImageData(d,0,0);const pores=new THREE.CanvasTexture(c);pores.wrapS=pores.wrapT=THREE.RepeatWrapping;pores.repeat.set(4,4);const m=skin.clone();m.roughness=.72;m.bumpMap=pores;m.bumpScale=.0006;return m;
}
export function detailedHead(parent,skin,hair,female=false){
 const holder=parent;parent=new THREE.Group();parent.position.y=-.09;parent.scale.x=1.08;holder.add(parent);
 const face=mesh(headGeometry,skinMaterial(skin),parent);face.name='MakeHuman_CC0_head';mesh(hairGeometry,hair,parent);
 // Eye positions are derived from the source mesh's eye-joint locations.
 for(const side of [-1,1]){sphere(parent,side*.03565,1.7901,-.0943,.0177,.0177,.0177,mat('#c4beb0',.35));sphere(parent,side*.03565,1.7901,-.1114,.008,.008,.0022,mat('#302619',.4));sphere(parent,side*.03565,1.7901,-.1134,.0038,.004,.0012,M.black);sphere(parent,side*.033,1.793,-.114,.0016,.0016,.0006,M.white);beam(parent,[side*.017,1.811,-.113],[side*.056,1.817,-.105],.0026,hair);}
 if(female){sphere(parent,0,1.8,.059,.075,.118,.047,hair);sphere(parent,0,1.675,.064,.045,.085,.04,hair);}
 else for(let i=0;i<13;i++){const x=(i-6)*.008;beam(parent,[x,1.68+Math.abs(x)*.3,-.062],[x,1.698+Math.abs(x)*.25,-.07],.0015,hair);}
 return face;
}
export function garment(parent,rings,material,segments=24){
 const positions=[],uv=[],indices=[];
 for(let j=0;j<rings.length;j++){const [y,rx,rz,z0=0]=rings[j];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a),wrinkle=Math.sin(a*7+y*53)*Math.sin(y*43)*.0015;positions.push(Math.sign(ca)*Math.pow(Math.abs(ca),.85)*(rx+wrinkle),y,z0+Math.sign(sa)*Math.pow(Math.abs(sa),.85)*(rz+wrinkle));uv.push(i/segments,j/(rings.length-1));}}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;if(rings.at(-1)[0]>rings[0][0])indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return mesh(g,material,parent);
}
