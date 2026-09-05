# 1573 Arena — Court Atlas

Independent route: `/1573-arena`. No changes to the existing Melbourne Park page.

The header offers Classic and Ink wash themes with a saved local preference. Ink wash uses a Three.js postprocessing pass for warm paper fibres, muted mineral-colour washes, fine hatching and crisp broken pen contours inspired by the supplied landscape painting; imaginary mountain silhouettes are an artistic backdrop. Fog is reserved for the distant landscape, while local lighting values and cast shadows remain distinct. It also applies to saved PNGs. Switching themes preserves the model, camera, lighting and interaction state. Both themes use compact navigation and support English/Chinese.

`model.ts` builds metre-scale Three.js geometry: regulation court markings, a sagging net, twelve rounded seating tiers, 2,822 instanced seats, handrails, shade hoods, six lighting masts, benches and an umpire chair. Architecture, landscaping and crowds are interpretive, not surveyed. The neighbouring arenas use separate OpenStreetMap polygons; the combined city footprint is deliberately excluded to prevent overlapping roof volumes.

The four user-supplied interior photographs inform the raised seating base: an estimated 1.65 m lift, continuous pale retaining wall with a dark upper fascia, lighter blue seating and intermediate aisle treads. `dimensions.ts` shares the lift between geometry, seated cameras and sunlight samples. Court level and neighbouring building heights are unchanged; the photo-derived height is not a surveyed measurement.

The supplied Google Earth oblique view informs a second precinct pass: Margaret Court Arena has clipped copper roof bays, lower perimeter slopes, glazed walls and mullions; Rod Laver has a separate pale roof with a central opening. Batman Avenue and the elevated Tanderrum Bridge follow existing mapped paths. The Yarra water edge and planting are approximate offsets from the mapped riverside trail. These rebuilt meshes use no Google imagery or downloaded Google mesh assets. Roof elevations, bridge elevation and river width remain visual estimates; they affect the indicative sunlight comparison. The precinct camera now includes more of the river and practice courts.

`ArenaExperience.tsx` provides five camera presets, orbit/zoom/pan, day/sunset/night lighting, context and crowd toggles, clickable points of interest, a demonstration ball animation, PNG capture and fullscreen. The page works without external textures, fonts, map keys, a backend or Blender. WebGL 2 is required.

Regenerate the compact local context from the existing dataset with `node scripts/extract-1573-context.mjs` from `frontend`. The source data attribution is preserved in `public/data/1573-context.json`, and the UI links both the sources and the downloadable derivative. City building data: CC BY 4.0. OpenStreetMap data: ODbL 1.0. Google Maps is a visual reference only; no map imagery is redistributed.

Visual references: the user-supplied Google Maps satellite view of 1573 Arena and Tennis Australia's `ImportantlocationsAO21.pdf`. Day/sunset/night and ball movement remain illustrative presets.

Summer sun covers January and February in a separate date/time mode (05:00–22:00 AEDT, UTC+11), defaulting to 15 January 2027. `solar.ts` implements the published NOAA approximate solar-position equations at the arena coordinates, including the model's 0.142-radian rotation. Sunrise/sunset use a −0.833° horizon threshold. Directional shadows follow the calculated sun; below the horizon there is no direct sunlight. The mode works in both visual themes.

The stand comparison casts rays toward the sun from nine seated head-height samples per side (three rows × three positions). It includes modelled structural blockers and keeps the surrounding buildings visible; instanced seats, people and decorative trees are excluded from the comparison. These counts describe the approximate model, not surveyed seat availability or guaranteed real-world shade. Clicking a stand moves the camera to that side. Clouds, temporary structures and UV are not simulated.

Run `node scripts/check-1573-solar.mjs` from `frontend` to check solar directions, coordinate rotation, January/February daylight boundaries, leap years and input validation. Method: https://gml.noaa.gov/grad/solcalc/solareqns.PDF.

`TennisRally.tsx` adds two articulated, stylized players with lateral recovery, racket swings and a synchronized bouncing ball. The grey shirt/white cap and yellow shirt take visual cues from the supplied Tennis TV reference (https://www.youtube.com/watch?v=5gj4iLvsQOo). This is hand-authored choreography, not motion capture or an exact match replay. Auto orbit starts the rally; Play/Pause rally controls it independently. `node scripts/check-1573-rally.mjs` checks trajectory continuity, net clearance, bounce height and racket contact alignment.

Run `npm run dev -- --port 3100`, then open `http://localhost:3100/1573-arena`. Shortcuts: 1–5 camera presets, R reset, H hotspots, Space orbit, Escape close panels.
