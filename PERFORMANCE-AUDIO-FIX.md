# Kurukkanmoola X Performance + Environment Audio Fix

## Performance
- Fixed the mountain-grass system: it was accidentally rebuilding the entire grass field every animation frame.
- Mountain grass is generated once at world creation and never streamed around the player.
- Removed player-distance near-tree generation to eliminate foliage pop-in and generation spikes.
- Lowered default/medium render resolution and shadow-map cost.
- Disabled bloom for balanced/low rendering.
- Switched to cheaper shadow filtering.
- Reduced texture anisotropy.

## Environment audio
- Added lightweight procedural wind and intermittent bird ambience using Web Audio.
- Audio starts after the player clicks Play, so browser autoplay restrictions are respected.
- Environmental audio pauses while menus are open and resumes during gameplay.
- Background music volume was reduced slightly so ambience can be heard.
