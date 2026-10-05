import { layouts } from "@/lib/coaching/catalog";

export default function CourtPreview({ diagram, label }: { diagram: string; label: string }) {
  const d = layouts[diagram];
  return (
    <svg viewBox="0 0 190 264" role="img" aria-label={label}>
      <rect x="27" y="20" width="136" height="220" fill="#1c4a36" stroke="#d5e2ce" />
      <path d="M39 20V240M151 20V240M39 72H151M39 188H151M95 72V188M27 130H163" fill="none" stroke="#d5e2ce" />
      {d.zones.map((z, i) => (
        <rect key={i} x={z[0]} y={z[1]} width={z[2]} height={z[3]} fill="#d4ee80" opacity=".24" />
      ))}
      {d.shots.map((p, i) => (
        <path key={i} d={`M${p[0]} ${p[1]}L${p[2]} ${p[3]}`} stroke="#efae65" strokeWidth="2" />
      ))}
      {d.players.map(([x, y, id]) => (
        <g key={id}>
          <circle cx={x} cy={y} r="9" fill="#e5efd7" />
          <text x={x} y={y + 3.5} fill="#173421" textAnchor="middle" fontSize="10">
            {id}
          </text>
        </g>
      ))}
    </svg>
  );
}
