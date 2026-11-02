# Town Bug Fix + Traffic/NPC Update

## Building fixes
- Building foundations now use the local average terrain height instead of the highest corner.
- Buildings on excessive slopes are rejected.
- Town buildings are restricted much closer to roads.
- Roadside buildings align their frontage with the road direction.
- This prevents houses from appearing embedded in hills, floating above terrain, or sitting far from the road.

## Traffic
- Increased road traffic to 38 vehicles.
- Vehicles are spawned from real road segments and assigned to existing AI traffic routes.
- Cars use both lanes and follow the existing route/avoidance system.

## NPCs
- Increased local NPC population to 72.
- NPCs spawn near roads in valid terrain rather than arbitrary water/steep areas.
