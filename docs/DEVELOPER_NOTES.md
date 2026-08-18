# Developer notes

## Tour data pipeline

The tour subsystem downloads public Sackmann-format archives, normalizes them
into SQLite, computes player metrics and Elo snapshots, and assembles scouting
reports. Match-level metrics and Match Charting Project micro-data are optional:
when the micro-data tables are missing or under-sampled, reports should keep the
macro layer and mark the micro section as unavailable.

## Analysis pipeline

Video analysis is organized as ingest, detect, map, events, tactics, and report.
The demo path supplies synthetic events so the product can be exercised without
model weights. The full path uses streaming frame iteration and optional court
keypoint mapping. LLM output is an interpretation layer over structured facts;
the deterministic fallback remains available when no API key is configured.

## Strategy board

Strategies are renderer-agnostic. A tactic contains editable frames, ball paths,
and optional strategy metadata (stable ID, category, goal, trigger, fallback, and
coach cue). The same tactic is rendered by the SVG 2D court and the Three.js 3D
court, so playback and share links do not diverge between views.
