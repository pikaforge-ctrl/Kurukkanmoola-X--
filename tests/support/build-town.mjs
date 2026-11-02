// Builds roads + roadside + town exactly as createWorld does (no renderer needed). Used by tests and debugging.
import * as L from '../../src/world-layout.js';
import {Batcher} from '../../src/kit/batcher.js';
import {Kit} from '../../src/kit/kit.js';
import {createBuildings} from '../../src/kit/buildings.js';
import {mulberry32} from '../../src/kit/util.js';
import {CollisionWorld} from '../../src/systems/collision.js';
import {buildRoadGraph} from '../../src/systems/road-graph.js';
import {RoadField} from '../../src/systems/road-field.js';
import {buildRoads} from '../../src/systems/roads-core.js';
import {buildRoadside} from '../../src/systems/roadside.js';
import {buildTown} from '../../src/systems/town.js';
import {stubAssets} from './stub-assets.mjs';

export function buildTownHeadless() {
  const assets = stubAssets(), B = new Batcher(320), K = new Kit(B, assets, mulberry32(5150)), bk = createBuildings(K), collision = new CollisionWorld(32);
  const graph = buildRoadGraph(L.roadChains), hub = graph.nodes.find(n => Math.hypot(n.x, n.z) < 2);
  const field = new RoadField(L.roads, {minX: -6150, maxX: 6150, minZ: -4300, maxZ: 4300});
  const roadVis = buildRoads({B, K, graph, hub});
  const roadside = buildRoadside({B, K, graph, roads: roadVis, buildings: bk, collision, M: {}, field});
  const W = {terrainHeight: L.terrainHeight, isWater: L.isWater, waterInfo: L.waterInfo, nearestRoad: L.nearestRoad, PLAYER_SPAWN: L.PLAYER_SPAWN, townKeepClear: L.townKeepClear, forestZone: L.forestZone, lakes: L.lakes, watercourses: L.watercourses};
  const town = buildTown({B, K, bk, graph, roads: roadVis, roadside, collision, field, assets, W});
  return {B, K, bk, graph, field, roadVis, roadside, town, collision, L};
}
