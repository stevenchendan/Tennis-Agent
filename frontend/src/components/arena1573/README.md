# 1573 Arena — Court Atlas

Independent route: `/1573-arena`. No changes to the existing Melbourne Park page.

`model.ts` builds metre-scale Three.js geometry: regulation court markings, a sagging net, twelve rounded seating tiers, 2,822 instanced seats, handrails, shade hoods, six lighting masts, benches and an umpire chair. Architecture, landscaping and crowds are interpretive, not surveyed. The neighbouring arenas use separate OpenStreetMap polygons; the combined city footprint is deliberately excluded to prevent overlapping roof volumes.

`ArenaExperience.tsx` provides five camera presets, orbit/zoom/pan, day/sunset/night lighting, context and crowd toggles, clickable points of interest, a demonstration ball animation, PNG capture and fullscreen. The page works without external textures, fonts, map keys, a backend or Blender. WebGL 2 is required.

Regenerate the compact local context from the existing dataset with `node scripts/extract-1573-context.mjs` from `frontend`. The source data attribution is preserved in `public/data/1573-context.json`, and the UI links both the sources and the downloadable derivative. City building data: CC BY 4.0. OpenStreetMap data: ODbL 1.0. Google Maps is a visual reference only; no map imagery is redistributed.

Visual references: the user-supplied Google Maps satellite view of 1573 Arena and Tennis Australia's `ImportantlocationsAO21.pdf`. Lights and ball movement are illustrative presets, not a sun-path simulation or match physics.

Run `npm run dev -- --port 3100`, then open `http://localhost:3100/1573-arena`. Shortcuts: 1–5 camera presets, R reset, H hotspots, Space orbit, Escape close panels.
