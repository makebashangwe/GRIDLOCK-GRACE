# Gridlock & Grace

A cozy isometric city-builder in the browser: a traffic puzzle (draw roads, watch cars find their way) that grows into a living city you run as mayor. Built with three.js and TypeScript.

**Status:** v0.1 and v0.2 done (avenues, a river with bridges, delivery trucks from the highway, and potholes fixed by the City Depot. You build from a blank map: homes and shops arrive in your hand and you choose where each goes (each home wants a shop; closer is better), turn buildings so their doors face a road, and draw roads from a daily tile budget. Cars route and queue. Weekday rush hours, day and night. Crossings can get a stop sign, traffic light or roundabout; uncontrolled busy crossings have crashes that Hook & Haul's tow truck clears. Each week has a goal and ends with a pick-one upgrade. Gridlock offers to keep building in Sandbox, and the town autosaves.). v0.3 done: homes grow from cottage to tower, bus lines, and an elevated highway with ramps.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 — the game
                   # http://localhost:5173/gallery.html — every model, labelled
npm run build      # type-check + production build into dist/
```

## Layout

```
index.html, src/main.ts      the game: input, HUD, main loop
src/game/tuning.ts           every gameplay number (tune here, not in code)
src/game/grid.ts             the 30 x 30 tile map
src/game/roadView.ts         road drawing: asphalt, sidewalks, dashes, crosswalks, jam colors
src/game/routes.ts           A* routing and lane paths
src/game/traffic.ts          instanced cars, following, crossing rules (stop / light / roundabout), crashes, tow truck
src/game/junctions.ts        stop signs, signals and roundabout islands on crossings
src/game/terrain.ts          ground tiles, the river and its banks, river generator
src/game/highwayView.ts      the elevated highway: deck, railings, ramps, pillars
src/game/city.ts             the hand of pieces, placing/turning/removing buildings, trips, deadlines, game over
gallery.html, src/gallery.ts asset gallery: every model in rows, flags any that fail to build
src/engine/stage.ts          renderer, warm lighting, angled orthographic camera and controls
src/engine/tick.ts           per-frame callbacks for animated parts (flags, beacons)
src/assets/core.ts           palette (C), material cache, mesh / rbox / shade helpers
src/assets/models.ts         all code-built models, ported from the Asset Test
public/models/               Meshy and Blender models (.glb)
```

## Asset rules

- **Scale:** 1 unit = 1 m, Y up. Road tile = 14 m (two 3.4 m lanes plus markings). Curb height 1.
- **Facing:** vehicles face +X; buildings, signs and people face +Z. Origin at ground center.
- **Palette:** Warm Sunset only (`C` in `core.ts` plus the swatches in the GRIDLOCK project's `style/color-palette.md`).
- **Budgets:** cars about 2,000–3,000 triangles; buildings up to about 6,000; hero pieces up to 10,000; crowd person about 530.
- **Materials:** `mat()` caches by color. Anything with a texture, a blink or a glow gets its own material, so the change doesn't spread to every part of that color.
- **Animation:** push a callback onto `TICK` instead of writing your own loop.
- **New models from ChatGPT:** paste the function into `models.ts` (or a new typed file), add it to the export list and the gallery, and check the gallery says "All models built."

## Design docs

Kept in the GRIDLOCK project on claude.ai: Game Design & Architecture, Simulation Rules, Asset List, Style Frames, Outside Tools Brief.
