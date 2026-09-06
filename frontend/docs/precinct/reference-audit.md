# Precinct reconstruction · 6 September 2026

Tracking: [AGE-282](https://linear.app/agentautomation/issue/AGE-282), with surface, arena, architecture and verification work in AGE-283–286. All tickets were created before reconstruction.

## Cross-validation

| Evidence | Used for | Limits |
| --- | --- | --- |
| [Google Earth](https://earth.google.com/web/search/john+cain+arena+australia/) overhead and 60° oblique views, inspected 6 September 2026 | Arena footprints, copper pleat direction, white sliding-roof panels and trusses, Kia canopy proportions, NTC repeated cowls, blue/clay court sequence, railway and paving context | First overhead view displayed imagery date `1/11/2024`; later views can use a different mosaic. Not a live event layout. No Google textures or meshes copied. |
| [Official AO26 map](https://ausopen.com/digitalmap) | Venue identity, relative placement, JCA bowl segmentation and access | Roofs are hidden to reveal navigation/interiors. Orange and other event overlays are not physical ground colours. Page still identifies map as AO26. |
| [COX · Rod Laver redevelopment](https://www.coxarchitecture.com.au/project/rod-laver-arena-redevelopment/) | Separate north/south/west entry pods, eastern pavilion and concourse glazing | Architectural forms retained; small dimensions estimated. |
| [Populous · Margaret Court Arena](https://populous.com/showcases/margaret-court-arena-redevelopment) | Pleated copper envelope and operable roof | Closed illustrative roof pose retained, longitudinal pleats corrected from aerial. |
| [Dianna Snape · Kia Arena](https://diannasnape.com.au/kiaarena), aerial photograph DJI_0282 | Broad continuous pale canopy, fine perimeter ribs, deeper bowl with blue seats and aisles | Original procedural reconstruction. Seats and rows are visual approximations. |
| [Jackson Architecture project description](https://www.archdaily.com/394179/national-tennis-centre-jackson-architecture) | NTC roof and northern ancillary facade | Search-indexed architect-supplied description cross-checked against Earth; full article fetch unavailable. |
| [Tennis Australia · clay courts](https://www.tennis.com.au/fan-zone/news/2021/06/06/clay-building-a-strong-foundation) | Six clay courts at NTC | Agrees with current local OSM tags and the inspected aerial. Earlier 2013 descriptions refer to eight; use six for the modelled dataset. |
| Local attributed Melbourne city building/OSM data | Every footprint, supporting roof classification, mapped court orientation, road/rail paths | A tier is not necessarily a separate building. Centrepiece is added separately from the administration building; duplicate bridge tier omitted. |

## Rebuilding decisions

- Outdoor courts retain blue hardcourt versus terracotta clay surfaces. Five tagged Eastern Plaza hard courts receive an estimated 5.75 m raised deck; clay remains at grade. Fences and lights are for outdoor courts, not internal arena playing surfaces.
- MCA pleats repeat across the roof width and run longitudinally. RLA and JCA have larger rectangular openings, parked sliding roof panels, rails/trusses, glazed facade bands and individual instanced seats. Their open pose is illustrative, not the roof pose in the closed-roof aerial.
- Kia's original Blender shell now has a broader canopy, full perimeter ribs and deeper terraces. The editable seat design stays in Blender; runtime uses instanced seats to keep the GLB under 1 MB.
- Centrepiece uses its individual OSM footprint and an estimated low-rise form separate from the taller administration building to its north. NTC receives repeated sculpted roof cowls and a glazed base. RLA eastern pavilion receives a distinct pale roof and solar-panel field.
- Paving uses an original metre-scaled procedural texture. Pastel event-zone washes are removed. Mapped rail tracks, green polygons and road classes are restored.
- Every source building tier has a rendering treatment in `building-inventory.json`. Unknown peripheral facades remain approximate; this audit does not certify their individual windows or elevations. MCG and AAMI use low-detail open stadium shells and fields instead of solid blocks. Unbranded oval kiosks and a small pavilion are illustrative event-scale details.

The reconstruction improves reference fidelity but is not photogrammetry or a surveyed digital twin. Roof mechanisms, court platform elevations, exact seat counts, landscaping and minor service buildings remain approximations.


## Verification result

### Western outer-court seating (AGE-295)

The supplied AO26 digital-map view shows courtside stands at Courts 5, 6, 7, 8, 12, 13, 14 and 15. Added nine stands (both sides at Court 6) keyed to mapped court names, using each court's centre and rotation. Includes stepped tiers, central aisles, individual instanced seats and railings; spectator instances share the existing toggle. Dimensions and row counts are approximate visual reconstruction. `node scripts/check-outer-stands.mjs` checks mapped coverage, finite tier dimensions and tier-corner clearance from every mapped court apron. Build and browser Western courts inspection passed.

### Grand Slam Oval rebuild (AGE-293)

The user's AO26 digital-map screenshot and [official map](https://ausopen.com/digitalmap) guide a new temporary event composition: eight petal shade membranes with masts/cables, broadcast screen, long glazed hospitality pavilion, curved southern terrace, kiosks, pergolas, benches and planters. These replace the generic cone and scattered boxes. Shapes, materials and approximate dimensions are authored locally; tenant identities and exact installation dimensions are not asserted.

The previous oval was only 2.5 mm above overlapping precinct paving. New ground sits at +0.24 m, above source paths/markings, and partitions its perimeter and interior into disjoint rings instead of stacking full discs. `node scripts/check-grand-slam-oval.mjs` checks surface elevation, total area, finite geometry and eight shade sails. The procedural precinct paving contrast is reduced to avoid the checkerboard appearance. Browser reviewed day and orbiting sunset views; build passed and console reported no errors.

### MCA open-roof preference (AGE-288)

Reviewed the [Populous project page](https://populous.com/showcases/margaret-court-arena-redevelopment) and its open-roof aerial photograph, cross-checked against [Tennis Australia's first roof opening](https://www.youtube.com/watch?v=BbhsTUht4wk). MCA now uses the open pose: copper pleated leaves parked beyond the baselines, a rectangular aperture, exposed edge trusses and travel rails. The previously hidden interior now has a stepped seating bowl around its existing court and rally. The aperture and panel dimensions are visual approximations, not surveyed measurements. This is a fixed open pose, not an interactive roof mechanism.

Production build (including lint/type validation) passed. Precinct checks cover six preserved clay tags, five elevated hard courts, individual landmark records, administration/Centrepiece separation, finite source coordinates, path clipping and the 1 MB GLB budget. Solar and rally regression scripts passed.

Browser screenshots reviewed for 1573 courtside/overview, MCA, RLA, Kia, JCA, Centrepiece, NTC, western courts, eastern courts, Grand Slam Oval and the AO overview. Also checked Kia night exposure, rainy Ink wash, and Chinese mobile settings at 390 × 844. Final production console reported no errors. AAMI peripheral roof self-shadow striping was corrected during QA. The viewport override was reset and production preview restarted on port 3101.
