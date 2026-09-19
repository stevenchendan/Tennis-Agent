# Drill library and routing

## Shipped routes

| Route | Purpose |
| --- | --- |
| `/drills` | Library and discovery |
| `/drills?q=volley&category=singles` | Shareable search and category filters |
| `/drills/mercy-shot-volleys` | Canonical drill page, instructions and synchronized 2D/3D playback |
| `/board` | Existing free-form tactics editor, linked from the library |

The existing home page links to the library. Unknown drill slugs return Next.js notFound. Drill pages generate metadata and static route parameters from the catalog. Do not include categories in the canonical drill URL: recategorizing a drill should not break shared links.

## Content model and expansion

`frontend/src/lib/drills/catalog.ts` owns searchable metadata, stable IDs, slugs, category, level, player requirements, skill tags and animation type. Keep IDs immutable and retain redirects if a published slug changes. The current catalog intentionally contains only the supplied drill, not invented placeholder content.

`motion.ts` owns the first drill's deterministic animation in metres. Renderers consume the same sampled frame. Three.js is the default; SVG remains available without WebGL. Renderers do not maintain their own clocks. Playback starts on user interaction to avoid automatic motion.

Before adding another drill, extract the current instructions and sequence labels into per-drill content, introduce a typed animation registry keyed by `animation`, and pass its duration, phases, scenarios and frame sampler to the common player. The current player is specific to mercy volleys. Future drills should use their own timeline data, not clone routes or assume mercy rules apply to every drill.

For hundreds of drills:

1. Store each drill in a separate validated content module or CMS record. Validate unique IDs/slugs, required instructions, source provenance and animation references during build.
2. Build a lightweight search index of metadata; keep full instructions and motion keyframes outside the library bundle. Add skill, level, player-count and equipment filters as query parameters, with URL-persisted sorting and pagination (24 items per page).
3. Move filtering and pagination to a server query if catalog size or update frequency makes client indexing unsuitable. Keep the public routes unchanged. Use static generation for curated content and revalidation for CMS publishing.
4. Add optional `/drills/collections/[slug]` for curated sessions and `/strategies/[slug]` for tactical concepts that link to reusable drills by ID. Keep personal practice plans separate at `/practice`; these are planned routes, not implemented pages.
5. Add per-drill keyframe validation, renderer-independent motion checks and a small browser suite covering search, navigation, playback and WebGL fallback. Maintain an explicit source/permission record for published source material.

## Reference interpretation

The supplied image defines players 3/1 followed by 4/2, with player 5 waiting, alternating cross-court points, a mercy overhead after a missed feed, −3 after a second miss, coach-side fence touches, and top-two rotation after several minutes. The linked video clarifies normal scoring and boundaries as noted below.

### Video reference review

Source: [Jorge Capestany — Mercy Shot Volley](https://tennisdrills.tv/courses/featured-drills/lessons/3-mercy-shot-volley-singles/). Reviewed the player transcript and selected demonstration frames in the user's accessible browser session. No video was copied into the app.

- Around 00:37–00:49: alternate cross-court halves; the attacking side rotates while the two players opposite remain on their side.
- Around 00:57–01:21: the mercy feed follows an unsuccessful first feed. A successful mercy ball continues into point play; a completed point is worth one. Two failed feeds incur −3.
- Around 02:16: doubles alleys count as in, even though this is a singles drill.
- Around 02:39–02:54: scale the initial feed to ability; no extra mercy feed is available after a successful first shot and subsequent rally error.

Both renderers highlight the full diagonal halves including alleys. The mercy scenario includes a defender return and another volley, rather than ending automatically at the overhead. The overhead choice comes from the printed sheet; this is an illustrative reconstruction, not motion extracted from the video.

The current 32-second timeline is a requested two-player adaptation. P1 attacks and P2 feeds and defends, one on each side of the net. The same players reset continuously onto the opposite diagonal at 16 seconds. P2 supplies the mercy lob; a double miss costs P1 three points and resets play. There is no coach actor or waiting queue. Swap roles between timed blocks in practice. Exact timings, ball trajectories and rally outcomes remain illustrative. The moonball toggle raises the first feed.

## 3D coaching scene

The drill uses the project's original `public/models/tennis/club-player.glb`, with separately posed torso, hips, limbs, hands, shoes and racket. `TennisPlayer.tsx` merges each articulated part by material for rendering efficiency and uses joint placement to connect hands to the grip. Contact frames share the exact ball/racket-head position; stroke poses now come from the imported Tennis-MoCap joint recordings. The mesh parts follow recorded joint positions; court travel remains procedural. This is not a biomechanical simulation.

`TrainingCourt.tsx` contains metre-scaled court markings, a sagging woven net and centre strap, textured hard-court material, fences, benches and a coach's ball basket. Textures are generated locally. `Court3D.tsx` provides daylight and shadows, an actual-size ball with an optional visibility halo, trajectory overlays, and broadcast/baseline/volley cameras. The volley camera mirrors for the second diagonal. Presentation mode expands the scene and retains playback controls; Escape exits it.

Ball motion uses piecewise parabolas with gravity, explicit racket contacts and bounces. The regression script checks continuity, ground contact, successful-shot net clearance and mirrored pairings. This is a coaching visualization; aerodynamic spin, exact friction and collision physics are not simulated.


See [tennis motion research](tennis-motion-research.md) for verified external candidates. Recorded volley, forehand and overhead motion is integrated. See the retained source BVHs, attribution and reproducible preprocessing script. The adapted recordings still require coach review before use as technique standards.
