"use client";

import type { Rally, Shot } from "@/lib/api";

// Court is 10.97 x 23.77 m; SVG y grows downward, so display y = LEN - y
// keeps the near player (y=0) at the bottom.
const W = 10.97;
const LEN = 23.77;
const SINGLES = 1.37;
const NET = LEN / 2;
const SVC_NEAR = NET - 6.4;
const SVC_FAR = NET + 6.4;
const CX = W / 2;

const px = (x: number) => x;
const py = (y: number) => LEN - y;

const PLAYER_COLORS: Record<number, string> = { 1: "#4ade80", 2: "#f472b6" };

export default function MiniCourt({
  rally,
  height = 420,
  showAllShots = true,
}: {
  rally: Rally;
  height?: number;
  showAllShots?: boolean;
}) {
  const shots = showAllShots ? rally.shots : rally.shots.slice(0, 1);
  return (
    <svg
      viewBox={`-1.2 -1.2 ${W + 2.4} ${LEN + 2.4}`}
      style={{ height, maxHeight: height }}
      className="mx-auto block"
      role="img"
      aria-label="rally shot map"
    >
      {/* court background */}
      <rect x={0} y={0} width={W} height={LEN} fill="#14352a" />
      {/* playing surface texture: outside court darker */}
      <rect x={-1.2} y={-1.2} width={W + 2.4} height={LEN + 2.4} fill="#0b1f19" rx={0.6} />
      <rect x={0} y={0} width={W} height={LEN} fill="#17553f" />

      {/* lines */}
      <g stroke="#e8f5ee" strokeWidth={0.12} fill="none" opacity={0.9}>
        <rect x={0} y={0} width={W} height={LEN} />
        <line x1={SINGLES} y1={0} x2={SINGLES} y2={LEN} />
        <line x1={W - SINGLES} y1={0} x2={W - SINGLES} y2={LEN} />
        <line x1={0} y1={py(0)} x2={W} y2={py(0)} />
        <line x1={SINGLES} y1={py(SVC_NEAR)} x2={W - SINGLES} y2={py(SVC_NEAR)} />
        <line x1={SINGLES} y1={py(SVC_FAR)} x2={W - SINGLES} y2={py(SVC_FAR)} />
        <line x1={CX} y1={py(SVC_NEAR)} x2={CX} y2={py(SVC_FAR)} />
      </g>
      {/* net */}
      <line x1={-0.5} y1={py(NET)} x2={W + 0.5} y2={py(NET)} stroke="#fbbf24" strokeWidth={0.16} opacity={0.85} />

      {/* shot trajectories */}
      {shots.map((s: Shot) => {
        const from = s.hit_position;
        const to = s.landing_position ?? from;
        const color = PLAYER_COLORS[s.player_id] ?? "#fff";
        const x1 = px(from[0]);
        const y1 = py(from[1]);
        const x2 = px(to[0]);
        const y2 = py(to[1]);
        return (
          <g key={s.index}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={0.14}
              strokeDasharray={s.is_serve ? "" : "0.55 0.3"}
              opacity={0.85}
              markerEnd=""
            />
            <circle cx={x1} cy={y1} r={0.28} fill={color} />
            <circle cx={x2} cy={y2} r={0.2} fill="#fde68a" />
            {s.is_serve && (
              <text x={x1} y={y1 - 0.45} fontSize={0.85} textAnchor="middle" fill={color}>
                S
              </text>
            )}
            {s.is_volley && (
              <text x={x1} y={y1 - 0.45} fontSize={0.85} textAnchor="middle" fill={color}>
                V
              </text>
            )}
          </g>
        );
      })}

      {/* labels */}
      <text x={CX} y={py(NET) - 0.5} fontSize={0.8} textAnchor="middle" fill="#fbbf24" opacity={0.8}>
        NET
      </text>
      <text x={CX} y={py(0) + 1.1} fontSize={0.9} textAnchor="middle" fill={PLAYER_COLORS[1]}>
        P1
      </text>
      <text x={CX} y={py(LEN) - 0.4} fontSize={0.9} textAnchor="middle" fill={PLAYER_COLORS[2]}>
        P2
      </text>
    </svg>
  );
}
