import { activeHalves, type Frame } from "@/lib/drills/motion";

export default function Court2D({ frame }: { frame: Frame }) {
  return <svg viewBox="-4 -6 19 36" role="img" aria-label="Animated overhead tennis court with numbered players and ball" style={{ width: "100%", height: "100%" }}>
    <defs><marker id="shot-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e4fa77" /></marker></defs>
    <rect x="-4" y="-6" width="19" height="36" fill="#142c29" />
    <rect width="10.97" height="23.77" fill="#244c44" />
    {activeHalves(frame.round).map((half, i) => <rect key={i} x={half.x} y={half.y} width="5.485" height="11.885" fill="#d5e78a" opacity=".12" />)}
    <g stroke="#d0ded1" strokeWidth=".065" fill="none"><rect width="10.97" height="23.77" /><path d="M1.37 0 V23.77 M9.6 0 V23.77 M1.37 5.485 H9.6 M1.37 18.285 H9.6 M5.485 5.485 V18.285 M5.485 0 V.3 M5.485 23.47 V23.77" /></g>
    <path d="M-1 11.885 H11.97" stroke="#f2eedb" strokeWidth=".16" />
    <path d="M-2 28 H13" stroke="#67867c" strokeWidth=".09" strokeDasharray=".3 .25" />
    <text x="5.5" y="29.3" fill="#90afa4" fontSize=".45" textAnchor="middle" letterSpacing=".12">BACK FENCE · TOUCH & RECOVER</text>
    {frame.ball && <path d={`M${frame.from.x} ${frame.from.y} L${frame.to.x} ${frame.to.y}`} stroke="#e4fa77" strokeWidth=".08" strokeDasharray=".25 .2" opacity=".6" markerEnd="url(#shot-arrow)" />}
    {frame.players.map((a) => <g key={a.id} transform={`translate(${a.x},${a.y})`}><circle r=".62" fill="#071c19" opacity=".25" cy=".13" /><circle r=".52" fill={a.color} stroke="#132a24" strokeWidth=".09" /><text y=".19" textAnchor="middle" fill="#142720" fontSize=".55" fontWeight="800">{a.id}</text></g>)}
    {frame.ball && <g><ellipse cx={frame.ball.x} cy={frame.ball.y} rx=".24" ry=".12" fill="#000" opacity=".35" /><circle cx={frame.ball.x} cy={frame.ball.y - frame.ball.z * .12} r=".19" fill="#e4fa77" stroke="#fff" strokeWidth=".04" /></g>}
  </svg>;
}
