import * as THREE from 'three';
import {buildFacadeAtlas, buildRoofTiles} from './tex-facade.js';
import {loadFonts, buildSignAtlas, buildPosterAtlas, buildRoadSignAtlas} from './tex-signs.js';
import {buildVegetationAtlas, buildWaterTextures, buildPaintWear} from './tex-nature.js';

/** Builds every procedural atlas once and the shared materials that the batchers/instancers use. */
export async function loadKitAssets(renderer) {
  await loadFonts();
  const facade = buildFacadeAtlas(renderer), roof = buildRoofTiles(renderer), signs = buildSignAtlas(renderer), roadSigns = buildRoadSignAtlas(renderer), posters = buildPosterAtlas(renderer),
    veg = buildVegetationAtlas(renderer), water = buildWaterTextures(renderer), wear = buildPaintWear();
  const glow = new THREE.Color(1, .82, .55);
  const materials = {
    atlas: new THREE.MeshStandardMaterial({map: facade.map, vertexColors: true, alphaTest: .5, roughness: .92, metalness: 0, emissive: glow, emissiveMap: facade.emissiveMap, emissiveIntensity: 0}),
    roof: new THREE.MeshStandardMaterial({map: roof.map, normalMap: roof.normalMap, vertexColors: true, roughness: .78, metalness: 0, side: THREE.DoubleSide}),
    sign: new THREE.MeshStandardMaterial({map: signs.map, vertexColors: true, roughness: .55, emissive: new THREE.Color(1, 1, 1), emissiveMap: signs.map, emissiveIntensity: 0}),
    poster: new THREE.MeshStandardMaterial({map: posters.map, vertexColors: true, alphaTest: .45, roughness: .92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1}),
    billboard: new THREE.MeshStandardMaterial({map: posters.billMap, vertexColors: true, roughness: .8, emissive: new THREE.Color(1, 1, 1), emissiveMap: posters.billMap, emissiveIntensity: 0}),
    roadSign: new THREE.MeshStandardMaterial({map: roadSigns.map, roughness: .5, metalness: .1, alphaTest: .1, side: THREE.DoubleSide}),
  };
  return {facade, roof, signs, roadSigns, posters, veg, water, wear, materials};
}
