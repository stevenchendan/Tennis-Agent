import { CX, NET, PAD, SINGLES, SVC_FAR, SVC_NEAR, W, LEN, py } from "@/lib/court";

// Court backdrop shared by MiniCourt and the tactics board: surface, lines, net.
export default function CourtBase() {
  return (
    <g>
      {/* playing surface texture: outside court darker */}
      <rect x={-PAD} y={-PAD} width={W + 2 * PAD} height={LEN + 2 * PAD} fill="#0b1f19" rx={0.6} />
      <rect x={0} y={0} width={W} height={LEN} fill="#17553f" />

      {/* lines */}
      <g stroke="#e8f5ee" strokeWidth={0.12} fill="none" opacity={0.9}>
        <rect x={0} y={0} width={W} height={LEN} />
        <line x1={SINGLES} y1={0} x2={SINGLES} y2={LEN} />
        <line x1={W - SINGLES} y1={0} x2={W - SINGLES} y2={LEN} />
        <line x1={SINGLES} y1={py(SVC_NEAR)} x2={W - SINGLES} y2={py(SVC_NEAR)} />
        <line x1={SINGLES} y1={py(SVC_FAR)} x2={W - SINGLES} y2={py(SVC_FAR)} />
        <line x1={CX} y1={py(SVC_NEAR)} x2={CX} y2={py(SVC_FAR)} />
      </g>
      {/* net */}
      <line
        x1={-0.5}
        y1={py(NET)}
        x2={W + 0.5}
        y2={py(NET)}
        stroke="#fbbf24"
        strokeWidth={0.16}
        opacity={0.85}
      />
      <text x={CX} y={py(NET) - 0.5} fontSize={0.8} textAnchor="middle" fill="#fbbf24" opacity={0.8}>
        NET
      </text>
    </g>
  );
}
