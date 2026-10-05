# Tennis-Agent 🎾

**Understand a tennis match, not just watch it.**

Upload a match video → track every shot → split into points → mine reusable tactical
patterns (serve+1 shot selection, direction combinations, rally-length↔outcome
relationships, net win rate) → coach report + Q&A, turning pro-level tactics into
something you can actually practice.

Tech stack: **Next.js 15** (frontend) + **FastAPI** (backend) + **YOLO/ultralytics**
(detection) + **LangChain** (tactics interpretation layer).

> For the project rationale review (why we didn't just build on Tennis-Vision-style
> projects), see [`docs/REVIEW.md`](docs/REVIEW.md).

## Quick Start

Prerequisites: Python 3.10+, Node 18+.

```bash
# Backend (first time)
cd backend
py -3.10 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt -r requirements-dev.txt

# Start the API (http://localhost:8000)
.venv/Scripts/python -m uvicorn app.main:app --reload

# Frontend (separate terminal, http://localhost:3000)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and click **"Watch a demo match"**.
The demo mode uses a built-in synthetic match (with two "planted" tactical patterns)
and **requires no model weights, GPU, or API key** — it walks the full
detection→events→patterns→report→Q&A pipeline and UI.

### Run Tests

```bash
cd backend
.venv/Scripts/python -m pytest tests/ -q --basetemp=./.pytest_tmp
```

24 tests cover: court geometry (deuce/ad, depth zones, serve direction labeling),
the event engine (hit/landing detection, rally segmentation, serve detection,
volley classification), pattern mining (planted patterns must be recovered end to
end), and the API (upload/analysis/Q&A full flow).

## Interactive Chinese coaching library — 120 sessions

Open `/lessons` from the home navigation for the native, mobile-friendly library
and `/lessons/001` for a complete session. There are 120 authored lessons across
six ability bands, with search, level/topic filters, favorites and classroom history.
Each lesson includes two drills, point play, coaching cues, assessment targets and
easier/harder adaptations, with 45/60/90-minute plans.

- **Interactive court:** drag players and targets by mouse or touch, move markers
  with arrow keys, demonstrate individual shot paths, mirror, undo and save the
  layout per lesson. Open the setup in the existing tactics editor to extend it.
- **Teaching mode:** configure the group, follow six phases, pause/resume a timer
  that survives reloads, record success/miss observations, undo a count, write notes
  and save the finished classroom session separately from the next draft.
- **Records:** filter favorite/taught/in-progress lessons and review the latest 300
  classes. JSON backups include drafts, favorites, history and court layouts;
  imports show a preview before merging, deduplicate history and pause timers.
  Old offline-library favorites and completion marks migrate automatically.

These features need no backend or account. Records stay in the current browser;
use backup/restore to transfer them between devices. Court diagrams are schematic
teaching aids; alternate shot choices are not presented as a continuous rally.

The previous portable HTML and PDF remain historical exports in `output/`;
the interactive project pages are the primary experience. Ability bands and target
success rates are original teaching guidance, not official ratings.

Content lives in `frontend/content/lessons/` (20 authored lessons per file), with the
shared generated catalog in `frontend/public/coaching/lessons.json`.
From `frontend/`, run `npm run dev` and visit `/lessons`. Native browser checks are
`scripts/coaching/check-native.cjs`, `check-court.cjs`, `check-session.cjs` and
`check-records.cjs`; set `BASE_URL` (default `http://127.0.0.1:3010`),
`PLAYWRIGHT_MODULE` and `BROWSER_PATH` as needed. Use `npm run build` for production
validation. The older standalone export workflow remains available:
Rebuild the standalone library with `node scripts/coaching/build-library.mjs`
from `frontend/`. Browser verification and PDF export use
`scripts/coaching/verify-library.cjs`; set `PLAYWRIGHT_MODULE` and `BROWSER_PATH`
when Playwright or Chromium are not at the local defaults. Run
`scripts/coaching/verify-pdf.py` afterward to validate all 120 two-page spreads
and add PDF bookmarks. Refresh the portable HTML copy after rebuilding.
See `docs/coaching-milestones.md` for delivery status.

### Player development tools

The lesson library links to four Chinese coaching tools inspired by the reviewed
pages of 《青少年网球教学训练大纲（试行本）》:

- `/development`: twelve-skill player passports, observations over time and linked
  practice lessons. Passports have their own validated JSON backup and recovery.
- `/development/pathways`: six ability-based lesson sequences. Age context changes
  teaching emphasis independently of the selected skill level; URLs retain choices.
- `/development/movement`: four-step movement/recovery demonstrations, crosscourt
  versus down-the-line comparison, mirroring and reduced-motion support.
- `/development/decisions`: six tactical situations with choice feedback, court
  diagrams, retries and related lessons.

Each lesson also includes an optional process goal, between-point reset routine and
reflection. These remain in the lesson draft until the class is saved, then appear
in classroom history and the existing class backup. Older backups remain supported.
All records stay in the browser. Export passports and classroom records separately.
Source pages are identified in each tool; ratings, lesson mappings and scenarios
are project adaptations, not official assessments. Coaches should review them in practice.

From `frontend/`, the additional browser checks are `scripts/coaching/check-development.cjs`,
`check-pathways.cjs`, `check-movement.cjs`, `check-decisions.cjs` and `check-mental.cjs`
in the same directory, using the same environment variables as the existing checks.

## Tennis Tactics Board (no backend required)

From the home page click **"Open the tennis tactics board"** (or visit `/board` directly): drag
players into position, drag to draw shot trajectories, arrange the tactic frame by
frame with per-frame notes, then click **Share** to generate a self-contained link
(tactic data is compressed into the URL with lz-string — no database, no accounts
needed). A student opening the `/t/…` link sees the frame-by-frame animation:
players glide between keyframes, shots play in sequence, with step/speed/seek
controls. The coach's draft autosaves to browser localStorage.

Grand Slam court themes (classic, Australian, French, Wimbledon, US Open) re-skin
the board; the chosen theme travels with the share link and viewers can switch it
locally for preview. Players can be added to either side independently (up to 4),
so the same board works for singles and doubles drills.

Playback also has a **3D view** (three.js / React Three Fiber, lazy-loaded):
editing stays 2D top-down for precision, while students watch the tactic on an
orbitable 3D court with a real net, capsule players and a ball flying a
distance-scaled arc. One toggle switches between 3D and the classic SVG view.

The separate `/melbourne-park` experience is a self-hosted, open-data digital-twin
foundation for the Australian Open precinct. It renders 863 surveyed building
tiers at their real coordinates and measured heights, 32 mapped tennis surfaces,
and local paths/roads/rail geometry. A game-style ground mode lets users enter the
precinct with WASD/arrow-key movement, drag-to-look, sprint and aerial/ground
transitions. Venue roofs use our own PBR material layer, while 1,234 mapped trees
and the street-light layer are GPU-instanced for street-level performance. The
experience includes day/night lighting, camera presets and navigation back to the tactics board.
There are no Google map or commercial 3D-tile dependencies.

The bundled geographic package is generated from City of Melbourne Open Data
(2020 Building Footprints, CC BY 4.0) and OpenStreetMap (ODbL). Refresh it with:

```bash
cd frontend
node scripts/sync-melbourne-park-open-data.mjs
```

The optional AO-zone overlay is explicitly labeled as a planning draft because
temporary tournament facilities change each year. Production event alignment
should be updated from the current official AO map or venue CAD/GIS rather than
silently treated as surveyed geometry.

### Pro workflow integrations (all frontend-only)

Inspired by how pro teams actually prepare (match charting → video/pattern review
→ game plan → drill), the analysis dashboard connects mined data to the board:

- **Rally → animated tactic**: in the point-by-point replay, one click converts a
  tracked rally into an editable tactics-board animation (one frame per shot,
  hitter at the hit position, opponent at their next contact, ball = hit →
  landing). Tweak and share the link.
- **Situation filters**: filter rallies by inferred break points / game points /
  serving games, outcome, and rally length. Scores are reconstructed on the
  client from per-point winners (heuristic — the UI labels the confidence).
- **Game plan tab**: a printable one-pager derived deterministically from mined
  patterns — opponent threats with counter-strategies, own weapons to reinforce,
  links to evidence rallies and related board drills.
- **Template library**: ready-made tactics in the editor (deuce-wide serve +
  open-court forehand, ad-T serve + approach, serve+1 crosscourt, return down
  the line, doubles poach, drop shot + topspin lob).

## Analyzing Real Videos (full mode)

Requires a tennis-ball detection YOLO weights file (any ultralytics format):

1. Obtain a tennis-ball model (e.g. a yolov8 model trained on the public Roboflow
   tennis-ball dataset, or the `last.pt` linked in the Tennis-Vision repo README);
2. (Optional) a court keypoint model (ResNet50, 14 keypoints — the community
   `keypoints_model.pth`) for precise homography mapping;
3. Set environment variables (or `backend/.env`):

```ini
TENNIS_BALL_MODEL_PATH=models/last.pt      # required
TENNIS_COURT_MODEL_PATH=models/keypoints_model.pth  # optional; falls back to proxy mapping (degraded labels)
TENNIS_PLAYER_MODEL_PATH=yolov8n.pt        # player detection; defaults to yolov8n
```

Then upload a video on the home page. **Filming tips**: fixed camera, both baselines
visible, the more top-down the angle the better (broadcast-style camera is ideal).

## LLM Tactical Report & Q&A (optional)

```ini
TENNIS_OPENAI_API_KEY=sk-...
# If using a proxy/gateway:
# TENNIS_OPENAI_BASE_URL=https://your-gateway/v1
TENNIS_LLM_MODEL=gpt-4o-mini
```

No key configured? Everything still works: reports are generated by deterministic
templates (rule engine), Q&A routes through heuristics based on pattern cards, and
the UI labels this clearly.

## Architecture Overview

```
frontend/  Next.js 15 (App Router, TS, Tailwind v4)
  ├─ /                Upload / demo entry / tactics board entry
  ├─ /board           Tactics board editor (multi-frame · players/shots · share link)
  ├─ /t/[data]        Tactic share page (self-contained URL, animated playback)
  └─ /analyses/[id]   Dashboard: stage progress · tactical report · pattern cards
  │                    · point-by-point replay (SVG court) · coach Q&A

backend/   FastAPI (Python 3.10, pydantic v2)
  ├─ app/api          videos / analyses / chat routes
  ├─ app/services
  │   ├─ detection    YOLO (lazy-loaded) + court keypoints + streaming frame reader
  │   ├─ analysis     event engine · court geometry · pattern mining
  │   ├─ llm          LangChain report chain + coach Q&A (heuristic fallback)
  │   ├─ fixtures     synthetic demo match (full experience without weights)
  │   └─ pipeline     stage orchestration + job state machine
  └─ tests/           24 tests
```

Data flow: `video → YOLO (players/ball) → homography to court coordinates → event
engine (hit/landing/rally/serve/volley) → pattern mining (PatternCard×N) → LangChain
report/Q&A`.

Design details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## The "Patterns" We Output

| Category | Example |
| --- | --- |
| Serve direction | "P1 deuce-side wide serve: 100% of serves on that side, 80% win rate behind it" |
| Serve+1 | "wide serve → third-shot crosscourt: N points, M won" — the core "designed point" of modern tennis |
| Shot n-grams | "P2 favors middle→middle twice in a row — predictable" |
| Rally length | "P1 owns short rallies ≤4 shots (70%), P2 owns long rallies 9+ shots" |
| Position | "P1 came to the net on N points, converting X%" |

Every card carries: sample size, confidence, **evidence point IDs**, and "how to use
this in your own game".

## Honest Limitations

- Shot type classification (forehand/backhand/slice) needs pose estimation — not
  implemented; we refuse to output unverifiable pseudo-labels;
- Ball speed is a **flat-projection approximation** (trajectory curvature ignored),
  use as a trend indicator only;
- Point winner attribution is heuristic (double-bounce/no-return signals +
  confidence), and the UI displays the confidence honestly;
- Frame-by-frame tracking quality depends on the ball-detection weights and camera
  angle; when tracking is insufficient the analysis fails explicitly rather than
  fabricating results.

## Roadmap

- [ ] Pose estimation (MediaPipe/YOLO-pose) → real forehand/backhand & open-stance recognition
- [ ] Player re-identification + doubles support
- [ ] Celery/Redis task queue (async analysis for long videos)
- [ ] Cross-match pattern aggregation ("your serve+1 vs. the population")
- [ ] Video timeline linking (jump from a point to the source video moment)
