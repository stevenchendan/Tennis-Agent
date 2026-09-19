# Tennis animation candidates

Reviewed public repositories through the GitHub connector on 2026-09-19. The Tennis-MoCap forehand volley, backhand volley, forehand groundstroke and overhead clips are now integrated. The player renders recorded joint motion on the existing articulated character; travel between strokes remains procedural. The adapted recordings still need coach review before being treated as technique standards.

## Recommended motion source: Tennis-MoCap

[Repository and README](https://github.com/jdpulgarin/Tennis-MoCap) · [Data](https://github.com/jdpulgarin/Tennis-MoCap/tree/main/data) · [Labels](https://github.com/jdpulgarin/Tennis-MoCap/blob/main/labels.csv) · [Copyright](https://github.com/jdpulgarin/Tennis-MoCap/blob/main/Copyright.md)

Real optical motion capture of 17 players at 100 Hz, including five high-performance players. BVH recordings cover serve, overhead, forehand/backhand groundstrokes and forehand/backhand volleys. The labels identify jarua, jduribe, jgacosta, lvargas and sgomez as high-performance subjects. Candidate files include jarua_VDerecha.bvh, jarua_VReves.bvh and jarua_Remate.bvh. Recorded motion must still be reviewed by a coach before being presented as a technique exemplar.

The repository states CC BY-SA 3.0 Unported and requests citation of Pulgarin-Giraldo et al. (2017), DOI 10.1007/978-3-319-52277-7_38. Preserve attribution and applicable share-alike terms in any derivative motion assets. This is skeleton motion data, not a finished character or ready-made website.

## Research reference: NVIDIA Vid2Player3D

[Repository](https://github.com/nv-tlabs/vid2player3d) · [Project demonstrations](https://research.nvidia.com/labs/toronto-ai/vid2player3d/) · [License](https://github.com/nv-tlabs/vid2player3d/blob/main/LICENSE.txt)

SIGGRAPH 2023 work on physically simulated tennis skills from broadcast video. Useful visual reference for coordinated whole-body motion and racket control. Its README explicitly says the demo cannot run because trained models are unavailable due to source-video licensing. The NVIDIA license limits use to noncommercial research and evaluation. It also depends on a Python/GPU simulation stack and separately obtained body assets. It is not a drop-in Three.js solution.

## Browser architecture reference: lumixed/tennis

[Repository](https://github.com/lumixed/tennis)

A React/Three.js tennis game with optional MediaPipe webcam control. Its README describes procedural players and no asset files. Useful for game architecture and ball simulation, but it does not supply verified tennis-technique motion clips. It would not by itself solve the current character-motion problem.

## Proposed implementation path

1. Preview high-performance Tennis-MoCap volley and overhead recordings; select clean repetitions with a tennis coach.
2. Use a properly skinned character skeleton. The existing separate-parts GLB requires replacement or a retargeting adapter; loading BVH alone will not fix its biomechanics.
3. Retarget and trim preparation, contact, follow-through and recovery clips. Verify joint mapping, scale, handedness, foot planting and racket grip.
4. Export reusable glTF animation clips. Keep drill travel paths separate from stroke animations and synchronize the ball with reviewed racket-contact markers.
5. Review normal and slow-motion playback from front, side and rear before labeling any animation as a technique demonstration.

Keep the canonical /drills/[slug] routes. A shared motion library can serve hundreds of drills without duplicating character assets or animation code per route.


## Implemented motion pipeline

`frontend/scripts/prepare-tennis-motion.mjs` parses the retained BVH sources with Three.js BVHLoader and samples world-space joints and wrist orientation into `recorded-motion.json` at 50 Hz. The first selected jarua repetition supplies each stroke. Contact markers are manually aligned, not source ball-tracking measurements. The generated dataset is about 102 KB and shared by both renderers through deterministic sampling.

The renderer now connects the mesh to recorded shoulder/elbow/wrist and hip/knee/ankle positions. It follows captured torso rotation and wrist motion instead of inventing a swing from the ball target. Soles are grounded, a fixed grip offset is calibrated per clip, and the ball endpoints come from the same recorded racket centre. Both diagonals retain right-handed anatomy. Feed strokes reuse the volley clip; court travel uses procedural gait. The original separate-parts mesh remains; no new skinned character was required for this joint-position adapter.

Source BVHs, copyright and a full change/attribution notice are retained in `frontend/public/models/tennis/mocap`. The adapted motion data retains CC BY-SA 3.0. The page exposes attribution and direct volley/forehand/overhead contact previews. Tests cover contact alignment on both diagonals, scrubbing, trajectories and two-player identity; visual review covers volley and overhead close-ups.

## Product improvement roadmap

Vid2Player3D informs the architecture, without copying its implementation or depending on its unavailable checkpoints. Its useful concepts are trajectory awareness, separate swing/recovery actions, continuous whole-body control, racket state, and outcome-directed shots.

### Phase 1 — coordinated movement (implemented)

- Movement is classified as ready, approach, stroke, close, split-step, recover or reset and exposed in the coaching UI.
- Step cadence follows cumulative court distance rather than elapsed animation time, so changing playback speed does not desynchronize the legs.
- P1 performs an explicit split-step at P2's groundstroke contact. Captured strokes temporarily own the whole-body pose, then blend into closing or recovery footwork.
- Recovery can face the travel direction while approach and hitting phases remain oriented to the court.

### Phase 2 — racket and shot intent

- Store racket centre, face normal and velocity at contact.
- Define every shot by incoming trajectory, intended landing area, height over the net and spin intent.
- Validate that the racket face and swing vector plausibly produce the authored outgoing path. Show coaching overlays for contact height, spacing and recovery position.

### Phase 3 — richer motion library

- Add dedicated hand feeds, backhand volleys, low/high volleys, split-steps and directional recovery clips.
- Select variants by contact height and movement demand; blend adjacent clips while preserving planted feet.
- Add a coach review state to every motion asset: draft, reviewed, approved, or rejected.

### Phase 4 — scalable drill engine

- Extract a common state machine and motion registry from this drill.
- Give each drill declarative roles, court zones, shot intents, scoring, phases and motion requirements.
- Add authoring previews and automated checks so hundreds of routes can reuse the same approved motion library.
