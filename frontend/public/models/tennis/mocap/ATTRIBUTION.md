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
- serve.bvh: data/jarua_Servicio.bvh (added 2026-11-18)
- backhand.bvh: data/jarua_Reves.bvh (added 2026-11-18)

## Adaptations

The first selected stroke in each recording is sampled at 50 Hz. Contact alignment markers are 1.94 s (forehand volley), 1.70 s (backhand volley), 2.12 s (forehand groundstroke), 2.20 s (overhead), 2.08 s (backhand groundstroke), and 2.56 s (serve). They are editorial markers, not measured ball collisions. Original recordings contain skeleton motion, without racket or ball markers.

Each selected body repetition was trimmed, converted to metres and retargeted onto the match skeleton. Root travel was scaled by 1.10. The body animation preserves the dominant wrist path and uses floor alignment, a closed gripping hand and a blended ready stance between shots. For the two-handed backhand, the second hand reaches the upper part of the handle using the recorded elbow bend direction. Court travel is authored. Both players are right-handed.

The adapted body motion retains CC BY-SA 3.0. The combined playback samples in `frontend/src/lib/drills/recorded-motion.json` also use racket orientation from the separately credited trials below. Those source terms and acknowledgements accompany the combined samples.

The recordings and visual adaptations have not been independently validated as coaching technique standards.

## Optically tracked rackets

The used tennis motion capture dataset was obtained from https://tennisdb.cs.pollub.pl at the Lublin University of Technology. Source terms and trial downloads appear on the [3DTennisDS dataset page](https://tennisdb.cs.pollub.pl/). Cite M. Skublewska-Paszkowska, P. Powroźnik, E. Łukasik and J. Smołka, [Tennis Patterns Recognition Based on a Novel Tennis Dataset – 3DTennisDS](https://www.astrj.com/pdf-191264-113712?filename=113712.pdf), 2024.

- Groundstrokes use the with-ball recordings of player 1, trial s8 in both tp1_fhb.zip and tp1_bhb.zip. Reflect the lateral coordinate of these left-handed captures before reconstructing a right-handed rotation.
- Volleys use player 1, trial s1 in tp1_fhvb.zip and tp1_bhvb.zip. Each file records the racket at 100 Hz. RH1, the lower hoop marker, and the two side markers determine its shaft and face. Each base ZIP can be downloaded from https://tennisdb.cs.pollub.pl/wp-content/uploads/2022/12/ with its filename appended.
- The serve uses Durlind, Martinez-Hernandez and Assaf (2025), [University of Bath serve dataset](https://researchdata.bath.ac.uk/1454/), CC BY 4.0. Use trial 4D_4.mat from the Spatio-Temporal Serve Data ZIP. We derive the racket axes from the lower and two side markers at 180 Hz. The overhead borrows the serve's overarm racket rotation on its own captured body motion. The [acquisition paper](https://www.mdpi.com/2504-4990/7/4/118) describes the marker layout.

To reproduce the derived rotations, place the five original archives in one folder, renaming the Bath ZIP to bath-serve-data.zip. Run `python scripts/extract-racket-markers.py <folder>` from the frontend directory with NumPy, SciPy and c3d installed. Rebuild the browser samples with `node scripts/retarget-tennis-motion.mjs` and the editable studio with Blender's build-match-studio.py. The application ships the small derived rotation tracks and source acknowledgements. Source ownership and the respective terms above continue to apply.
