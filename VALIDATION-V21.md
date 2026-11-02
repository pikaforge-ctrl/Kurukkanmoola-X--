# V21 validation

- `npm test`: all 10 physics/world tests passed, September 24, 2026.
- `npm run check`: all listed game, world and server modules passed syntax checks.
- Browser smoke test before the final animation-clock patch: no JavaScript errors; keyboard movement covered 2.6 metres; vehicle entry/exit passed. See BROWSER-CHECK.json.
- Rendered town, tea country, falls, dam and map captures are included. These were produced with software WebGL, not a hardware performance benchmark. Some capture HUD values were stale; this led to the clock fix below.
- Final animation-clock correction initializes from the first animation frame and clamps negative time deltas. Direct execution of the actual clock expression passed initial-frame, normal-frame, backward-timestamp and long-frame checks. A second full browser run after this small correction was not performed.
- World tests check dimensions/elevations, road grades and shared junction continuity, carved water beds, raised crossings, mesh/collision height agreement, landmark bounds and forest coverage.
- WORLD-AUDIT.json records generated counts. WORLD-MAP.png records the generated geography.

Not benchmarked: hardware GPU frame rate, sustained multiplayer load or public internet deployment. Existing multiplayer is the V20 guest polling service. Screenshot quality is constrained by software rendering. Reference-exact photorealism, boat controls, interiors and economy/job systems are outside this implementation.
