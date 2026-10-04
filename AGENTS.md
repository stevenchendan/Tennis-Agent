# Project workflow

- Drive work in small, reviewable milestones documented in Markdown.
- For each milestone, create a fresh `codex/` branch from the latest remote default branch before committing its work.
- Keep each PR focused. Stage explicit files; preserve unrelated local changes.
- Validate the milestone, inspect the staged diff and final PR file list, then create a PR with concrete validation evidence.
- Merge only after applicable checks pass and required review/protection conditions are satisfied. Never bypass failing checks or required review, and never force-push the default branch.
- After merging, synchronize the default branch before starting the next milestone branch.
- Follow the user's authorization for autonomous PR creation and merging in this session. Report external blockers accurately; do not mark queued or local-only work as merged.
- Track the coaching-library delivery in `docs/coaching-milestones.md`.
