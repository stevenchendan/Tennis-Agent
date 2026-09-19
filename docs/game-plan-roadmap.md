# Professional game-plan workspace

## Product review — 2026-09-20

The site has useful building blocks: shareable tactics, a playing-style library, guided practice, match tracking, scouting and analysis-derived recommendations. The main gap is a coherent coach-to-player preparation workflow.

The existing `GamePlan` component requires an analysis result, generates advice from broad pattern categories and offers printing. It does not provide independently authored plans, named student briefs, explicit Plan B triggers, draft history or a focused player handoff. Keep the analysis report as evidence; add a dedicated workspace for decisions.

## Milestone 1 — Prepare → brief → share

- [x] Dedicated `/game-plan` workspace available from home, drill navigation and analysis reports.
- [x] Match context: player, coach/author, opponent, date, surface, objective and opponent observations.
- [x] Three priorities, serve/return/rally Plan A, switch triggers and Plan B, plus a pressure reset cue.
- [x] Attach up to three existing visual patterns with playback links.
- [x] Save multiple validated local plans; clearly distinguish saved and unsaved changes.
- [x] Player briefing with a concise courtside view, preparation checklist and printable output.
- [x] Immutable share snapshot, explicit included-content preview, clipboard fallback, file export/import and malformed-link handling.
- [x] Honest delivery semantics: no sent/read claims, no silent external messages, no implied account sync.
- [x] Meaningful validation tests, production build and desktop/mobile browser checks.

Sharing uses a compressed URL fragment, not an access-controlled account. Anyone with the link can read the included plan. Existing copies are snapshots, so edits require a new link. Local preview URLs cannot be used remotely; file export/import allows transport until a reachable deployment is configured. The application prepares the handoff; the user chooses how to send it.

## Milestone 2 — Close the coaching loop

- [ ] Authenticated coach/student relationships and private assignment storage.
- [ ] Explicit publish/version history, revocation and player acknowledgement.
- [ ] Player reflection, coach feedback and revision comparison.
- [ ] Offline access and cross-device synchronization, including conflict handling.

## Milestone 3 — Evidence-based preparation

- [ ] Import selected analysis observations with rally references and sample sizes.
- [ ] Connect completed match tracking to planned priorities, without claiming causation.
- [ ] Attach coach-edited board sequences directly and save their exact version.
- [ ] Add doubles roles, junior adaptations and bilingual briefs.
- [ ] Coach-review starter examples and test comprehension with actual students.

## Acceptance scenarios

1. A coach creates a named plan without uploading video, saves it, reloads and recovers the same content.
2. A player can read three priorities, each situation's fallback and a between-point cue on a phone.
3. A copied snapshot opens read-only with the same plan and attachments; editing the original does not change it.
4. Missing, corrupt or oversized shared data produces a useful error, never a broken page.
5. Storage or clipboard failure is reported accurately, with a manual/file alternative.
6. Changing drafts cannot silently discard unsaved work; a new plan does not overwrite an existing one.

## Verification log

Milestone 1 implemented. `node scripts/check-match-plans.mjs` passed: schema bounds, readiness, Unicode round trips, snapshot independence, invalid attachments and corrupt/oversized payloads. TypeScript, targeted ESLint and production build passed. Browser checks covered starter authoring, save/reload, player briefing, copied snapshot, editable-copy handoff, file export/import, unsaved-draft locking, corrected date editing and invalid-link recovery. Reviewed desktop and 390px mobile layouts. Print styling is implemented; PDF pagination has not been separately rendered and reviewed.

The dedicated review origin contains clearly labelled QA sample plans only. Preview isolation: `TENNIS_BUILD_DIR=.next-game-plan` with the normal Next.js dev command prevents another running dev process from overwriting this preview. The default output remains `.next` when the variable is unset.

