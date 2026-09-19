# Court-level video trial

Source: https://www.youtube.com/watch?v=qXtJDJ1U7_8

Creator: Roger That Tennis. Title: Court Level View Best Points · Tennis On Another Level Part 6. Reviewed 2026-09-19.

## Delivered

Open `/video-study` for two authored practice adaptations: short-ball transition and wide-ball recovery. Each includes source timestamp links, optional YouTube embedding, manual observations, practice rules, technique review questions, 2D/3D tactical playback and a tactics-board import link. Shared drill navigation links to the study.

The data is in `frontend/src/lib/drills/video-study.ts`. Source observations are separate from authored tactic coordinates and coaching cues. The existing body-motion library is not changed or presented as extracted from this video.

## Evidence and limits

The source played in the browser. Sampled frames were visually inspected at 5, 10, 15, 20, 25, 30 and 35 seconds. The first three show baseline/forecourt positioning and a later lowered ready position; the next three show a serve, lateral displacement and subsequent ready position in the Federer/Goffin segment. The 35-second frame is a different Paris scene and is excluded from the selected second reference.

This is sparse visual review, not continuous tracking or a full-video analysis. No hit/bounce timestamps, shot speeds, joint angles, 3D poses, stroke correctness scores or inferred winners are claimed. Drill feeds, shot directions, target positions, repetition counts and timing are authored practice choices. Source and animation clocks are independent. The generic tactical figures are not technique demonstrations.

Metadata extraction succeeded with the existing yt-dlp installation. Video-file download returned HTTP 403, including a retry with the installed Node JavaScript runtime. No file was successfully downloaded and no pose estimation ran. No source footage is committed or redistributed.

## Next input for motion extraction

A local MP4 of the selected rally is required to continue this trial with frame processing. Preserve source timestamps and frame rate, split camera cuts before processing, calibrate each court view separately, track the chosen player with confidence values, and flag occluded/blurred joints. Racket and ball need separate detection. Monocular pose estimates require further reconstruction and review before retargeting to the player rig; they cannot be treated as measured 3D motion.

## Integration fix

Browser verification exposed an existing TacticPlayer startup bug: the first requestAnimationFrame timestamp can precede an effect's performance.now(), producing a negative frame index. The clock now starts at the first RAF callback, clamps negative deltas and clamps the frame index at zero.
