# Tennis drill product roadmap

## Product goal

Build a coach-presentable drill library that explains court positioning and demonstrates credible tennis movement in synchronized 2D and 3D. Every drill should be easy to find, review in slow motion and reuse in a practice plan.

## Quality bar

A drill is ready for coaches when:

- the rules and scoring match the cited source;
- player roles, active court zones and shot sequence are immediately understandable;
- preparation, contact, follow-through, split-step and recovery form one continuous action;
- the ball meets the racket and clears the net without visual discontinuities;
- all motion assets have provenance, license and coach-review status;
- 2D, 3D, controls, mobile layout and WebGL fallback pass regression checks.

## Delivery plan

| Phase | Outcome | Status | Exit criteria |
| --- | --- | --- | --- |
| Foundation | Stable drill routes, library, shared playback and 2D/3D renderers | Complete | Canonical drill route and catalog work in production build |
| Two-player Mercy drill | P1 attacks; P2 feeds and defends; both alternate diagonals | Complete | All scenarios, scoring and resets use only P1/P2 |
| Recorded stroke motion | Volley, forehand and overhead use attributed motion capture | Complete | Racket/ball contacts, grounding, handedness and skeleton tests pass |
| Coordinated footwork | Approach, stroke, close, split-step, recovery and reset behave as one sequence | Complete | Distance-synchronized steps and contact-timed split-step pass tests and visual review |
| Shot mechanics | Racket face, swing direction and intended landing are modeled together | Next | Each contact exposes racket state and validates its outgoing shot intent |
| Motion coverage | Dedicated feeds and contact-height variants; backhand volley now added | In progress | Approved motion exists for every shot used by the drill |
| Coach review | Technique review and revision workflow | Planned | Every teaching animation has draft/reviewed/approved status and reviewer notes |
| Drill platform | Declarative drill schema and reusable motion registry | Planned | A second drill can ship without cloning the Mercy player or route code |
| Library scale | Search, filters, collections and paginated content source | Planned | Hundreds of drills remain fast and routes remain stable |

## Current sprint: shot mechanics

1. Add racket centre, face normal and velocity to recorded motion samples.
2. Describe every stroke with incoming ball, intended landing area, net clearance and tactical purpose.
3. Add automated plausibility checks between racket motion and outgoing ball direction.
4. Add optional coach overlays for contact height, spacing, racket path and recovery target.
5. Review volley, forehand and overhead from baseline, side and contact cameras.

## Product decisions

- Vid2Player3D is an architecture and quality reference. Its code, trained models and research-only license are not project dependencies.
- Tennis-MoCap remains the current recorded motion source, with CC BY-SA attribution preserved.
- Motion correctness takes priority over cosmetic character detail.
- A drill animation can be tactically useful before it is approved as a technique standard, but the UI must state that distinction.
- Shared motion assets and drill data must stay separate so improvements benefit the entire future library.
