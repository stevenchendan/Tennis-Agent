"use client";

import CourtBase from "@/components/CourtBase";
import { CX, LEN, PAD, PLAYER_COLORS, W, py } from "@/lib/court";
import type { Rally, Shot } from "@/lib/api";

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
      viewBox={`${-PAD} ${-PAD} ${W + 2 * PAD} ${LEN + 2 * PAD}`}
      style={{ height, maxHeight: height }}
      className="mx-auto block"
      role="img"
      aria-label="rally shot map"
    >
      <CourtBase />

      {/* shot trajectories */}
      {shots.map((s: Shot) => {
        const from = s.hit_position;
        const to = s.landing_position ?? from;
        const color = PLAYER_COLORS[s.player_id] ?? "#fff";
        const x1 = from[0];
        const y1 = py(from[1]);
        const x2 = to[0];
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
      <text x={CX} y={py(0) + 1.1} fontSize={0.9} textAnchor="middle" fill={PLAYER_COLORS[1]}>
        P1
      </text>
      <text x={CX} y={py(LEN) - 0.4} fontSize={0.9} textAnchor="middle" fill={PLAYER_COLORS[2]}>
        P2
      </text>
    </svg>
  );
}
