# V24 — Kerala environment upgrade: notes

The game was **not rebuilt**. Player, camera, terrain, map, mission/job system, economy, vehicles, UI and multiplayer are the V23 code. What changed is what the
world is *made of*: placeholder cubes became a procedural, stylized Kerala environment, plus new systems for traffic, people, wildlife, atmosphere and tea shops.
Everything is generated at load time (no new art files except the bundled Malayalam sign font), seeded and deterministic, so every client builds the same world.

## Try it
`npm start` (or the launchers), then:
- **E** next to a tea-shop door → *Press E to Enter*. Inside: walk to the counter → **E** opens the menu (click, or keys **1–6**): milk tea ₹10, black tea ₹8,
  coffee ₹12, parippu vada ₹8, pazham pori ₹10, uzhunnu vada ₹8. Money is deducted through the existing economy; with too little money the purchase is refused.
  Walk to the door and press **E** to leave. **F** talks to the shopkeeper and customers as with any NPC.
- Tea shops: next to bus stops and on busy streets (12 on the map) plus the existing hill-view chaya on the mountain viewpoints.
- `?debug` exposes `window.__PERUNNA__` (world, interiors, helpers) for testing.

## What is in the world now
| Area | Implementation |
|---|---|
| Town | `src/town-plan.js` grows a bazaar ring road, an outer loop and ~490 curved streets/lanes (T-junctions, four-ways, dead-end lanes) around the original roundabout and arms. `src/systems/town.js` fills frontage lots by zone: continuous 1–4 storey shop rows in the core, villas and traditional tiled houses with compound walls, gates and paths further out, huts and thatch in rural areas. |
| Buildings | `src/kit/buildings.js`: shop house, traditional tiled house (after the reference photo), villa, college, hotel, supermarket, tea shop, petrol station, Hindu temple, church, mosque, hut, stall, bus shelter, cell tower, workshop, parked motorcycles. Facades are built from a 59-tile procedural atlas (`tex-facade.js`) with lit-window variants for night. |
| Signage | ~50 bilingual (English + Malayalam) fictional shop signs plus your landmark names, weathered fictional posters, roof hoardings, direction boards, name plates and warning signs (`tex-signs.js`). Posters/billboards use faceless silhouettes and invented slogans — no real politicians, parties or propaganda. |
| Roads | `systems/roads-core.js`: asphalt ribbons with kerbs, pavements, drains, centre/edge lines (worn paint), zebra crossings, speed breakers, junction pads, bridges with parapets and piers, hill crash barriers, a roundabout with painted kerb ring. `roadside.js`: street lamps, concrete poles with sagging wires (and service drops to buildings), bus shelters, signs, planted medians. |
| Vegetation | `kit/vegetation.js` + `systems/veg-place.js`: coconut, areca, banana, mango, jackfruit, rubber, flame tree, banyan, bamboo, pine, wild forest trees, bushes, reeds, ferns, rocks; ~350k GPU-instanced plants with 2 LODs, wind sway, far thinning; forests change by elevation band; rubber in rows; gardens, street trees, village infill and shorelines. |
| Water | `systems/water.js`: flow-map shader (no visible looping), depth colour/opacity, shoreline and rapids foam, slow lake motion; 22 rain-fed hill streams; the falls drape a foamy cascade over the cliff (water never floats above terrain) with rocks and spray. |
| Atmosphere | `systems/atmosphere.js`: elevation-dependent drifting mist (one patch of three.js's shared fog chunk, so terrain, trees, buildings and water all get it; lowlands stay clear), golden-hour sun, dusk transition for emissive windows/signs, 8 pooled street-lamp lights only at night. |
| Traffic | `systems/traffic.js`: graph-based, pooled (≈28 active vehicles around you), **left-hand lanes**, junction give-way by road hierarchy with deadlock breaker, car following, yielding to pedestrians and you, one-way roundabout, bus/auto/truck/bike mix. The V23 route code (which faced some vehicles backwards) is retired. |
| People | `systems/npc-life.js`: bus-stop waiters, customers sitting on tea-shop benches, people outside shops and at gates, named roles at landmarks (traffic officer, priests, students, fishermen, bus conductor), pooled pavement walkers and zebra-crossing pedestrians who wait for a gap. Same `name`/`words`/`mesh` interface and F-to-talk as before. |
| Wildlife | `systems/fauna.js`: street dogs (rest, trot, move away when you approach), crows, egrets and kites. The V23 mountain wildlife is unchanged. |
| Tea shops | `systems/interiors.js`: one interior "stage" (counter with snack jars, kettles, tumblers, tables/benches, ceiling fan, steam, shopkeeper and customers) built high above the map at a fixed in-bounds x/z, so ordinary collision/camera code works. |

## Performance design
Static kit geometry is authored through a batcher into ~1.7k meshes keyed by (material, 320 m cell) and distance-culled per layer; vegetation is instanced with LOD
and far thinning; vehicles and walkers are pooled; at most 8 real lights exist (the old per-lamp `PointLight`s, ~52 always on, are gone); the old tea-bush instancing
now uses a 20-triangle bush instead of 80 (it was the single biggest triangle cost in the original forest and hill views).

Measured in headless Chromium with a **software** WebGL renderer (one frame, medium quality, includes everything three.js submits):

| View | Draw calls | Triangles |
|---|---|---|
| Spawn, looking over the town | 1.34k | 1.60M |
| Town street (East Highway) | 0.64k | 0.83M |
| Densest core view (bazaar) | 1.65k | 1.92M |
| Canal / river | 0.46k / 0.23k | 0.63M / 0.37M |
| Mountain forest | 0.29k | 0.88M |
| Kurinji Falls | 0.66k | 1.25M |

V23 measured 2.45k calls / 1.58M triangles at its spawn view in the same harness. **No real-GPU frame-time measurements were possible**, so treat FPS as unverified;
the quality setting scales culling, vegetation LOD and traffic counts, and the in-game quality menu is the first thing to turn down on weak hardware.

## Tests (`npm test`)
Collision (oriented boxes, rays, road-clearance field), road graph, **traffic simulation** (heading matches motion, 100% of samples in the left lane, never inside solids, never stuck,
roundabout direction), and **world integrity** (no footprint on a carriageway, no overlapping buildings, required landmarks, tea-shop exits free, poles off the road).
Tests run the real town builder headlessly (`tests/support`); browser checks were done in headless Chromium with software WebGL (no console errors on load; tea-shop
enter/buy/refuse/exit verified).

## Extension points
- New building: add a builder to `kit/buildings.js`, a plan in `systems/town.js` (`PLAN`) and, if it should appear in lots, a case in `choose()`.
- New plant: add a function to `SPECIES` and a row to `SPECIES_INFO` in `kit/vegetation.js`.
- Tea menu: edit `TEA_MENU` in `systems/interiors.js`. More interiors can reuse the stage mechanism (`enter`/`exit`).
- Real art: the kit is procedural by design; GLB models can replace a species/building by loading it in the matching builder (the existing `assets.js` manifest loader is still available).

## Known limits (honest list)
- No real-GPU benchmarking; load time in software rendering is ~20 s (world build ≈13 s), expect noticeably less on real hardware.
- The game has **no stamina/energy system**, so tea and snacks give a message and animation but no stat bonus.
- KTX2/Basis texture compression was not authored; textures are generated canvases. Reflections rely on the environment map (no planar reflections).
- Traffic LOD is by pooling/despawn; there are no distant proxy vehicles. Vehicles do not tilt on slopes.
- The falls are a draped whitewater cascade over the cliff, not a vertical curtain, and its outline shows the 10 m water raster; pedestrians do not use bus doors; interiors are one shared room design.
- Buildings use a stylized look (flat-shaded archetypes with texture atlases), not photoreal detail.
