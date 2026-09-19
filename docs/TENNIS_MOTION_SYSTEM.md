# Tennis motion system

## Interactive review workspace

`/movement-lab` previews the shared player independently of drill choreography. It includes four adapted captured strokes, an illustrative feed, six illustrative movement states and the composed Mercy Shot sequence. Serve and backhand groundstroke are visible as unavailable entries; they cannot silently play a different clip. No unit is currently coach-approved.

Use the front, side and rear cameras, 0.25× / 0.5× / 1× playback, 50 Hz frame stepping, timeline and contact-frame jump to inspect the current implementation. The yellow marker appears at the annotated racket contact only; it does not represent a simulated incoming ball in isolated technique previews. Strategy mode uses the actual Mercy Shot court and ball sequence.

This workspace still uses the articulated character. A skinned player, motion retargeting, planted-foot transitions and coaching review remain outstanding. Passing the numerical tests does not establish anatomical or coaching accuracy.

The product should demonstrate hundreds of drills without rebuilding a player for every page. A drill therefore composes reusable **movement units** and **technique units** on a court timeline.

## Unit contract

A technique unit owns:

- a stable identifier and coach-facing label;
- handedness and stroke family;
- its captured or authored clip source;
- preparation, contact and follow-through timing;
- coaching checkpoints;
- a readiness status: captured, illustrative or planned.

A movement unit owns the player's intent between strokes: ready, approach, split-step, close, recover or reset. Court choreography selects the movement unit; the technique unit controls the body and racket around a contact.

The racket is part of the player rig. The ball contact is derived from the racket pose at the technique unit's annotated contact frame. Drills must not position a racket and ball independently.

## Composition model

Each drill supplies roles, court positions, movement intervals, stroke events, ball flights and scoring rules. The shared player system resolves those events into animation. A drill may change sequence and tactics without changing the technique itself.

Example:

1. ready;
2. split-step on feeder contact;
3. approach;
4. forehand-volley at the annotated contact frame;
5. close the net;
6. split-step on the defender's groundstroke;
7. second volley;
8. recover or reset.

## Library roadmap

### Foundation

- ready stance, split-step and landing;
- forward, backward, lateral shuffle and crossover movement;
- adjustment steps and balanced recovery;
- forehand and backhand groundstrokes;
- forehand and backhand volleys;
- overhead and serve.

### Expansion

- slice, topspin and flat variants;
- approach shots, half volleys, drop volleys and swinging volleys;
- lob, drop shot and return-of-serve families;
- open, neutral, semi-open and closed stance variants;
- left-handed retargeting and two-handed backhand variants.

## Quality gate

Every captured unit must pass technical and rendering review before it is marked production-ready:

- feet remain grounded without sliding;
- preparation begins before the ball arrives;
- spacing and contact height match the intended stroke;
- the hand remains attached to the grip;
- the racket face and string-bed centre are stable at contact;
- the ball meets the annotated string-bed contact point;
- recovery blends without snapping or changing handedness;
- front, rear, side and coach cameras remain readable;
- a qualified coach approves the visible technique.

## Source strategy

### Skinned rig implementation (2026-09-19)

Both views now use the CC0 Quaternius weighted character (`tennis-athlete.glb`), adapted from the original rig mirrored by UMRAM-Bilkent/supine-human-model. The previous disconnected rigid body parts are no longer used for the player. The existing racket mesh is retained.

`frontend/scripts/retarget-tennis-motion.mjs` reads the original BVH rotations, aligns target bind-pose axes (including the differing wrist reference axes), and bakes local target-bone quaternions. Playback interpolates rotations in the hierarchy rather than interpolating world joint endpoints. Each clip has one floor alignment, preserving vertical motion. Contact positions are regenerated from the target wrist plus palm/grip offset. Racket grip and editorial contact times still need coaching review; this is not an approved biomechanical model.

Run `node scripts/retarget-tennis-motion.mjs`, `node scripts/check-drills.mjs`, and `node scripts/check-skinned-motion.mjs` inside `frontend`. The last check loads the actual exported skin and verifies intermediate-frame limb lengths, wrist/contact agreement, finite deformed vertices and floor penetration. These are structural checks, not evidence of correct tennis technique. Footwork is still illustrative and needs captured locomotion plus foot planting.

Tennis-MoCap is the primary captured source because it contains the six core tennis gestures and already fits the BVH ingestion pipeline. MinimumTennis can inform missing transitions and handedness after individual animation provenance is verified. Vid2Player3D is an architecture reference for hierarchical control rather than a runtime dependency.
