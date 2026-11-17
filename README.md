# Gridlock & Grace

A cozy isometric city-builder in the browser: a traffic puzzle (draw roads, watch cars find their way) that grows into a living city you run as mayor. Built with three.js and TypeScript.

**Status:** pre-production done, v0.1 (the road puzzle) in progress.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 — the game
                   # http://localhost:5173/gallery.html — every model, labelled
npm run build      # type-check + production build into dist/
```

## Layout

```
index.html, src/main.ts      the game (v0.1 starts from a blank map on a 14 m road-tile grid)
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
