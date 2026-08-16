"use client";

import { useRef, useState } from "react";
import CourtBase from "@/components/CourtBase";
import { BALL_COLOR, LEN, PAD, PLAYER_COLORS, W, py } from "@/lib/court";
import type { BallPath, PlayerPos, Point, Tactic } from "@/lib/tactic";

export type BoardMode = "move" | "path" | "erase";

interface TacticCourtProps {
  tactic: Tactic;
  /** Frame to display/edit. Clamped to the last frame when out of range. */
  frameIndex: number;
  /** Present ⇒ interactive editor mode. Absent ⇒ read-only playback rendering. */
  mode?: BoardMode;
  onMovePlayer?: (frameIndex: number, playerId: number, pos: PlayerPos) => void;
  onAddPath?: (frameIndex: number, path: BallPath) => void;
  onDeletePath?: (frameIndex: number, pathIndex: number) => void;
  onDeletePlayer?: (frameIndex: number, playerId: number) => void;
  /** Playback: interpolated player positions (overrides the frame's own). */
  playersOverride?: PlayerPos[];
  /** Playback: current ball position, null while no shot is in flight. */
  ballAt?: Point | null;
  height?: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export default function TacticCourt({
  tactic,
  frameIndex,
  mode,
  onMovePlayer,
  onAddPath,
  onDeletePath,
  onDeletePlayer,
  playersOverride,
  ballAt,
  height = 540,
}: TacticCourtProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [draw, setDraw] = useState<{ from: Point; to: Point } | null>(null);

  const idx = Math.min(Math.max(frameIndex, 0), tactic.frames.length - 1);
  const frame = tactic.frames[idx];
  const players = playersOverride ?? frame.players;

  function toCourt(e: React.PointerEvent): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * (W + 2 * PAD) - PAD;
    const vy = ((e.clientY - r.top) / r.height) * (LEN + 2 * PAD) - PAD;
    return {
      x: clamp(vx, 0.2, W - 0.2),
      y: clamp(LEN - vy, 0.2, LEN - 0.2),
    };
  }

  // --- editor: drag players (move mode) ---
  function onPlayerDown(pl: PlayerPos) {
    return (e: React.PointerEvent) => {
      if (mode === "erase") {
        e.stopPropagation();
        onDeletePlayer?.(idx, pl.id);
        return;
      }
      if (mode !== "move") return; // path mode: let the event bubble to start a line here
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragId(pl.id);
    };
  }
  function onPlayerMove(e: React.PointerEvent) {
    if (dragId === null) return;
    const p = toCourt(e);
    onMovePlayer?.(idx, dragId, { id: dragId, x: p.x, y: p.y });
  }
  function onPlayerUp(e: React.PointerEvent) {
    if (dragId === null) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragId(null);
  }

  // --- editor: drag to draw a shot path (path mode) ---
  function onSvgDown(e: React.PointerEvent) {
    if (mode !== "path") return;
    const p = toCourt(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraw({ from: p, to: p });
  }
  function onSvgMove(e: React.PointerEvent) {
    if (!draw) return;
    setDraw({ ...draw, to: toCourt(e) });
  }
  function onSvgUp() {
    if (!draw) return;
    if (dist(draw.from, draw.to) >= 0.5) onAddPath?.(idx, draw);
    setDraw(null);
  }

  const cursor =
    mode === "path" ? "crosshair" : mode === "erase" ? "pointer" : dragId !== null ? "grabbing" : "default";

  return (
    <svg
      ref={svgRef}
      viewBox={`${-PAD} ${-PAD} ${W + 2 * PAD} ${LEN + 2 * PAD}`}
      style={{ height, maxHeight: height, touchAction: "none", cursor }}
      className="mx-auto block w-full select-none"
      role="img"
      aria-label="tactics court"
      onPointerDown={onSvgDown}
      onPointerMove={onSvgMove}
      onPointerUp={onSvgUp}
      onPointerCancel={onSvgUp}
    >
      <defs>
        <marker
          id="tb-arrow"
          viewBox="0 0 10 10"
          refX="7.5"
          refY="5"
          markerWidth="4.5"
          markerHeight="4.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={BALL_COLOR} />
        </marker>
      </defs>

      <CourtBase />

      {/* shot paths of this frame */}
      {frame.paths.map((p, i) => (
        <g
          key={i}
          onClick={
            mode === "erase"
              ? (e) => {
                  e.stopPropagation();
                  onDeletePath?.(idx, i);
                }
              : undefined
          }
        >
          <line
            x1={p.from.x}
            y1={py(p.from.y)}
            x2={p.to.x}
            y2={py(p.to.y)}
            stroke="transparent"
            strokeWidth={0.55}
          />
          <line
            x1={p.from.x}
            y1={py(p.from.y)}
            x2={p.to.x}
            y2={py(p.to.y)}
            stroke={BALL_COLOR}
            strokeWidth={0.14}
            strokeDasharray="0.55 0.3"
            opacity={0.9}
            markerEnd="url(#tb-arrow)"
          />
          <circle cx={p.to.x} cy={py(p.to.y)} r={0.18} fill={BALL_COLOR} opacity={0.9} />
        </g>
      ))}

      {/* live preview while drawing a path */}
      {draw && dist(draw.from, draw.to) > 0.05 && (
        <g>
          <line
            x1={draw.from.x}
            y1={py(draw.from.y)}
            x2={draw.to.x}
            y2={py(draw.to.y)}
            stroke={BALL_COLOR}
            strokeWidth={0.16}
            opacity={0.65}
            markerEnd="url(#tb-arrow)"
          />
          <circle cx={draw.from.x} cy={py(draw.from.y)} r={0.22} fill="none" stroke={BALL_COLOR} strokeWidth={0.08} />
        </g>
      )}

      {/* players */}
      {players.map((pl) => {
        const color = PLAYER_COLORS[pl.id] ?? "#e7efe9";
        return (
          <g
            key={pl.id}
            transform={`translate(${pl.x}, ${py(pl.y)})`}
            onPointerDown={onPlayerDown(pl)}
            onPointerMove={onPlayerMove}
            onPointerUp={onPlayerUp}
            onPointerCancel={onPlayerUp}
            style={{ cursor: mode === "move" ? "grab" : mode === "erase" ? "pointer" : "crosshair" }}
          >
            {(dragId === pl.id || mode === "erase") && (
              <circle r={0.62} fill="none" stroke={color} strokeWidth={0.07} opacity={0.6} />
            )}
            <circle r={0.42} fill={color} stroke="#0a0f0d" strokeWidth={0.06} />
            <text y={0.18} fontSize={0.55} textAnchor="middle" fill="#0a0f0d" fontWeight={700}>
              {`P${pl.id}`}
            </text>
          </g>
        );
      })}

      {/* ball in flight */}
      {ballAt && (
        <g>
          <circle cx={ballAt.x} cy={py(ballAt.y)} r={0.34} fill="#ffffff" stroke={BALL_COLOR} strokeWidth={0.1} />
        </g>
      )}
    </svg>
  );
}
