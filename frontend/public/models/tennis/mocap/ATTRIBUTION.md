# Recorded tennis motion

Source: Tennis-MoCap, https://github.com/jdpulgarin/Tennis-MoCap

Authors: J. D. Pulgarin-Giraldo, A. M. Alvarez-Meza, L. G. Melo-Betancourt, S. Ramos-Bermudez, G. Castellanos-Dominguez.

Publication: A Similarity Indicator for Differentiating Kinematic Performance Between Qualified Tennis Players. LNCS 10125, pp. 309–317 (2017). https://doi.org/10.1007/978-3-319-52277-7_38

Original motion and the adapted motion data are licensed under Creative Commons Attribution-ShareAlike 3.0 Unported: https://creativecommons.org/licenses/by-sa/3.0/

The upstream Copyright.md is preserved in this directory. No endorsement by the authors or recorded player is implied.

## Source recordings

Downloaded 2026-09-19 from the repository's main branch. The labels.csv file identifies subject jarua as high-performance.

- volley.bvh: data/jarua_VDerecha.bvh
- backhand-volley.bvh: data/jarua_VReves.bvh
- forehand.bvh: data/jarua_Derecha_18seg.bvh
- overhead.bvh: data/jarua_Remate.bvh

## Adaptations

The first selected stroke in each recording is sampled at 50 Hz. Contact alignment markers are 1.94 s (forehand volley), 1.70 s (backhand volley), 2.12 s (forehand groundstroke), and 2.20 s (overhead). They are editorial markers, not measured ball collisions. Original recordings contain skeleton motion, without racket or ball markers.

Changes: trim individual repetitions, convert centimetres to metres, scale root travel by 1.10, normalize root position and facing, retarget captured world rotations into the Quaternius character hierarchy with bind-pose alignment, use one floor offset per clip, calibrate a fixed racket grip offset per clip, close the racket hand and blend local bone rotations to a ready stance between strokes. Racket and ball contact coordinates are regenerated from the actual target wrist and palm offset. Feed movements reuse the volley clip. Travel between strokes remains procedural. Both players remain right-handed on both diagonals.

The adapted joint, local bone rotation and racket samples are in frontend/src/lib/drills/recorded-motion.json and can be reproduced with frontend/scripts/retarget-tennis-motion.mjs using the BVH files here and quaternius-human.glb. That generated motion dataset is also CC BY-SA 3.0. This notice applies to the motion data, not a relicensing of unrelated application code or the original character mesh.

The recordings and visual adaptations have not been independently validated as coaching technique standards.
