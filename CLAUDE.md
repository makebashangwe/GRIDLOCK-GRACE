# Notes for Claude working in this repo

Owner: Keba (Makeba). She's new to Blender and game code: explain in plain words and keep the toy-town look consistent.

## The game
Gridlock & Grace: cozy isometric city-builder. Traffic puzzle first (v0.1), then city growth, businesses and government. The design docs live in the GRIDLOCK project on claude.ai (Game Design & Architecture, Simulation Rules, Asset List). The Asset List sheet tracks every asset's status; update it when an asset changes.

## Conventions
- three.js 0.170, TypeScript strict, Vite. `npm run build` must pass before any push.
- 1 unit = 1 m, Y up. Road tile 14 m, lane 3.4 m, curb 1. Vehicles face +X, buildings and people face +Z.
- Warm Sunset palette only. `C` in `src/assets/core.ts` holds the in-game roles.
- Camera: orthographic, angle π/4, tilt 0.62, rotation in 90° steps. No free camera.
- Crowds and traffic are drawn with InstancedMesh (one batch per part). Never one Mesh per person or car in the game.
- Textured, blinking or glowing parts get their own material; `mat()` is a shared cache.
- `src/assets/models.ts` is ported as-is and has `@ts-nocheck`. New code goes in typed files.
- After adding or changing a model, check `gallery.html` reports "All models built."

## v0.1 notes
- The simulation runs on the main thread in small fixed steps for now; the design calls for a Web Worker once the city gets big.
- Phone results (Nov 17): 4,000 cars + 6,000 people at 60 fps on Keba's phone in the performance check.

## Still to port from the Asset Test
- Meshy GLB fixes: zero-length normal repair, texture recolor (police station navy to teal, house roof variants), texture shrinking.
- Crowd system (`makeCrowd` / `citizenLook`), weather (rain and snow with the height snapshot), crash scene, ghost road, city depot.
