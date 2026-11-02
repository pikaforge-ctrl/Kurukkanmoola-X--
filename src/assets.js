import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
/** Optional authored model pipeline. Empty manifest means no missing-asset requests.
 * GLB: metres, Y-up, front faces -Z. A URL loads only when explicitly configured.
 */
export async function loadModelManifest(){const r=await fetch('./assets/models/manifest.json');if(!r.ok)throw new Error('Cannot read model manifest');return r.json();}
export async function mountModel(config,parent,fallback,targetHeight){
 if(!config?.url)return null;
 const gltf=await new GLTFLoader().loadAsync(config.url),g=gltf.scene;
 g.rotation.y=config.rotationY||0;g.updateMatrixWorld(true);let bounds=new THREE.Box3().setFromObject(g);const size=bounds.getSize(new THREE.Vector3());g.scale.multiplyScalar((config.height||targetHeight)/Math.max(size.y,.001));g.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(g);const center=bounds.getCenter(new THREE.Vector3());g.position.set(-center.x,-bounds.min.y,-center.z);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});parent.add(g);fallback.visible=false;
 const mixer=gltf.animations.length?new THREE.AnimationMixer(g):null,actions={};let current=null;
 if(mixer)for(const [state,name] of Object.entries(config.animations||{})){const clip=THREE.AnimationClip.findByName(gltf.animations,name);if(clip)actions[state]=mixer.clipAction(clip);}
 return {object:g,mixer,update(dt,state){if(actions[state]&&current!==actions[state]){current?.fadeOut(.2);current=actions[state];current.reset().fadeIn(.2).play();}mixer?.update(dt);}};
}
