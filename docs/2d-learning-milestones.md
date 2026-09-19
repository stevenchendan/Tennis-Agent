# 2D learning platform milestones

Goal: help players understand a pattern, make a decision and practise it at a suitable difficulty. Difficulty belongs to a skill, not a permanent player label.

## Milestone 1 — Cross-court learning slice

- [x] Add `/learn/cross-court`, discoverable from drill navigation and the tactics template picker.
- [x] Provide beginner, intermediate and advanced goals, targets, feeds, scoring and adaptations.
- [x] Add a self-paced Read → Hit → Recover court walkthrough with optional target and recovery guides.
- [x] Add a decision checkpoint with explanatory feedback, including multiple reasonable advanced choices.
- [x] Connect the lesson to a practical two-player exercise with setup and success criteria.
- [x] Add success/miss logging, undo, clear, save and per-level session history on this browser (latest 20 sessions).
- [x] Suggest a manageable variation after at least 10 attempts; preserve manual level selection.
- [x] Complete implementation checks and production build.
- [x] Complete desktop and mobile interaction review.
- [ ] Obtain coach review of original lesson content and positioning before marking it approved.

The diagram is illustrative. The advanced short-ball question is separate from the baseline diagram. Progress suggestions are simple thresholds, not an ability rating. No account sync or automatic motion assessment is provided. Existing Mercy drill playback remains a separate experience.

## Milestone 2 — Reusable lessons and discovery

### Playing styles section — 2026-09-19

- [x] Add `/playing-styles` with six original demonstrations: aggressive baseliner, patient baseliner, counterpuncher, big server, serve-and-volley and all-court.
- [x] Share one sampled timeline between 2D and 3D, with Split view, play/pause, reset, speed, looping, scrubbing and shot stepping.
- [x] Explain each style's intent, visual cues, tradeoffs and an easier practice variation.
- [x] Link from drill navigation and the tactics picker; link demonstrations to related practice.
- [x] Validate motion and build; review desktop/mobile rendering and both court views.
- Verification: `node scripts/check-playing-styles.mjs` checks all six styles for timeline bounds, court bounds, net clearance, player continuity and ball contact continuity. TypeScript, targeted ESLint and production build passed. Browser checks covered play/pause, shot stepping, view-switch time preservation, style reset, speed, loop control, keyboard scrubbing and reset. Reviewed real WebGL rendering and 390px mobile layout; adjusted the new demo camera to show both players and the full court.
- [ ] Coach-review the illustrative sequences. 3D uses position markers and schematic trajectories rather than technique animation.

- [ ] Extract a validated multi-lesson schema once a second lesson establishes shared needs.
- [ ] Add return consistency and recovery, with dedicated situations and diagrams.
- [ ] Add skill, difficulty, duration, player-count and equipment filters.
- [ ] Give strategy templates explicit links to their matching practice exercises.
- [ ] Add persistent lesson/difficulty URLs and resume state.

## Milestone 3 — Broader access

- [ ] Add solo/wall, partner and coach-fed variations where suitable.
- [ ] Add reviewed junior court and ball variants with matching geometry.
- [ ] Add adjustable movement demands and left/right-side examples.
- [ ] Review keyboard, screen reader, contrast and touch use across lessons.
- [ ] Unify language selection across the tactics and drill experiences.

## Milestone 4 — Session planning and progress

- [ ] Assemble short practice plans from selected goals and available time.
- [ ] Add confidence/reflection notes and trends per skill.
- [ ] Add account-backed persistence, export and deletion controls.
- [ ] Add coach-assigned exercises and reviewed progression guidance.

## Verification log

- 2026-09-19: TypeScript (`npx tsc --noEmit`), targeted ESLint and full `npm run build` passed; route statically generated.
- 2026-09-19: Browser review verified recovery step, level changes, advanced alternative feedback, score logging, undo, same-level score preservation, difficulty locking while a scorecard is active, 8/10 progression guidance, save and reload persistence. Desktop and 390px mobile layouts reviewed. Test session is stored only in the QA browser for the local preview origin.
- Coach review remains open; broader junior, solo, doubles and account-sync features are future milestones, not completed capabilities.
