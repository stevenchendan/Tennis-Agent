# Tennis athlete character

Original character: Quaternius, CC0 1.0 (public domain).
Source mirror: https://github.com/UMRAM-Bilkent/supine-human-model/blob/main/assets/human.glb
Repository license: https://github.com/UMRAM-Bilkent/supine-human-model/blob/main/LICENSE
Creator: https://quaternius.com/
License text: https://creativecommons.org/publicdomain/zero/1.0/legalcode

`quaternius-human.glb` is the original rigged asset (not the posed medical model).
`tennis-athlete.glb` is our adaptation: normalized scale and facing, tennis apparel vertex colours, original skin weights and skeleton. Rebuild with `node scripts/retarget-tennis-motion.mjs` from the frontend directory.

Tennis motion has a separate CC BY-SA 3.0 license. See `mocap/ATTRIBUTION.md`.
The character's bundled animation clips are not represented as tennis technique captures.

## Match athlete

`match-athlete.glb` uses the Quaternius motion skeleton with a fitted MakeHuman HM08 mesh, young male target, textured skin, short04 hair, brown eyes, male_casualsuit06 shirt and tailored shorts, and shoes05. The MakeHuman project and its system asset pack distribute these assets under CC0. The jersey material accepts each player's team colour at runtime.

Body, target, rig definitions and weights come from [MakeHuman revision a8bc2d54](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data). The third-party source files identify their original creators. [MakeHuman asset license](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.md) · [System asset catalog and download](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)

To reproduce, place the following inputs in one directory, preserving their basenames.

- From the pinned repository, use `3dobjs/base.obj`, `rigs/default.mhskel`, `rigs/default_weights.mhw`, `targets/macrodetails/caucasian-male-young.target`, and `eyes/materials/brown_eye.png`.
- From the system asset pack, use the OBJ and MHClO files for male_casualsuit06, shoes05, short04 and high-poly eyes, their diffuse textures, and `young_lightskinned_male_diffuse.png` from the young_caucasian_male skin.
- From the frontend directory, run `python scripts/build-match-athlete.py <input-directory>` with NumPy and Pillow installed. Run `blender --background --factory-startup --python-exit-code 1 --python scripts/build-match-studio.py` to extract the project racket and assemble the packed, editable `art/match-athlete.blend` file.

The Blender review scene uses body motion adapted from Tennis-MoCap under CC BY-SA 3.0 and racket rotations derived from the Lublin and Bath optical trials. [Source credits and terms for the combined scene](./mocap/ATTRIBUTION.md).
