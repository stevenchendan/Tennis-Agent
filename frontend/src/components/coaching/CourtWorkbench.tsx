"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { layouts, type Layout, type Lesson } from "@/lib/coaching/catalog";
import { encodeTactic, type Tactic } from "@/lib/tactic";
import { W, LEN } from "@/lib/court";
import s from "./coaching.module.css";

const copy = (value: Layout): Layout => JSON.parse(JSON.stringify(value));
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
function restore(raw: unknown, original: Layout): Layout | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Layout;
  if (
    !Array.isArray(value.players) ||
    value.players.length !== original.players.length ||
    !value.players.every(
      (p, i) =>
        Array.isArray(p) &&
        p.length === 3 &&
        p[2] === original.players[i][2] &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]) &&
        p[0] >= 10 &&
        p[0] <= 180 &&
        p[1] >= 10 &&
        p[1] <= 254,
    )
  )
    return null;
  for (const key of ["zones", "shots", "moves"] as const) {
    if (
      !Array.isArray(value[key]) ||
      value[key].length !== original[key].length ||
      !value[key].every(
        (a) => Array.isArray(a) && a.length === 4 && a.every((n) => Number.isFinite(n) && n >= 0 && n <= 264),
      )
    )
      return null;
  }
  if (!value.zones.every(([x, y, w, h]) => w > 0 && h > 0 && x + w <= 180 && y + h <= 250)) return null;
  return { ...original, players: value.players, zones: value.zones, shots: value.shots, moves: value.moves };
}

export default function CourtWorkbench({ lesson }: { lesson: Lesson }) {
  const original = layouts[lesson.diagram],
    storageKey = `tennis-lesson-court-v1:${lesson.id}`;
  const [layout, setLayout] = useState(() => copy(original));
  const [selected, setSelected] = useState("player:0"),
    [line, setLine] = useState(0);
  const [playing, setPlaying] = useState(false),
    [progress, setProgress] = useState(0);
  const [showMoves, setShowMoves] = useState(true),
    [showZones, setShowZones] = useState(true),
    [ready, setReady] = useState(false);
  const [message, setMessage] = useState(""),
    [undo, setUndo] = useState<Layout | null>(null);
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<{ key: string; x: number; y: number; start: Layout } | null>(null);
  const marker = useId().replaceAll(":", "");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = restore(JSON.parse(raw), original);
        if (saved) setLayout(saved);
        else setMessage("旧布置无法读取，已使用课程默认布置。");
      }
    } catch {
      setMessage("当前浏览器无法读取布置；仍可调整并送到战术板。");
    }
    setReady(true);
  }, [storageKey, original]);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1800, 1);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  function save(next: Layout) {
    setLayout(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setMessage("布置已保存在此浏览器。");
    } catch {
      setMessage("无法保存布置；本次调整仍可使用，可送到战术板继续。");
    }
  }
  function change(next: Layout) {
    setUndo(copy(layout));
    setPlaying(false);
    setProgress(0);
    save(next);
  }
  function position(e: PointerEvent) {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
  }
  function shifted(start: Layout, key: string, dx: number, dy: number) {
    const next = copy(start),
      [kind, index] = key.split(":"),
      i = Number(index);
    if (kind === "player") {
      next.players[i][0] = clamp(start.players[i][0] + dx, 10, 180);
      next.players[i][1] = clamp(start.players[i][1] + dy, 10, 254);
    } else {
      const [x, y, w, h] = start.zones[i];
      next.zones[i] = [clamp(x + dx, 10, 180 - w), clamp(y + dy, 14, 250 - h), w, h];
    }
    return next;
  }
  function startDrag(e: PointerEvent<SVGGElement>, key: string) {
    if (!ready) return;
    e.preventDefault();
    const p = position(e);
    drag.current = { key, x: p.x, y: p.y, start: copy(layout) };
    setSelected(key);
    setPlaying(false);
    setProgress(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const p = position(e),
      d = drag.current;
    setLayout(shifted(d.start, d.key, p.x - d.x, p.y - d.y));
  }
  function endDrag() {
    if (drag.current) {
      setUndo(drag.current.start);
      save(layout);
      drag.current = null;
    }
  }
  function nudge(dx: number, dy: number) {
    change(shifted(layout, selected, dx, dy));
  }
  function keys(e: KeyboardEvent<SVGGElement>, key: string) {
    const delta: { [key: string]: number[] } = {
      ArrowLeft: [-3, 0],
      ArrowRight: [3, 0],
      ArrowUp: [0, -3],
      ArrowDown: [0, 3],
    };
    if (delta[e.key]) {
      e.preventDefault();
      setSelected(key);
      const [x, y] = delta[e.key];
      change(shifted(layout, key, x, y));
    }
  }
  function mirror() {
    const next = copy(layout);
    next.players = next.players.map(([x, y, id]) => [190 - x, y, id]);
    next.zones = next.zones.map(([x, y, w, h]) => [190 - x - w, y, w, h]);
    for (const key of ["shots", "moves"] as const)
      next[key] = next[key].map(([x, y, a, b]) => [190 - x, y, 190 - a, b]);
    change(next);
  }
  function chooseLine(i: number) {
    setPlaying(false);
    setProgress(0);
    setLine(i);
  }
  const shot = layout.shots[line];
  const sequence = ["serveplus", "return", "approach", "net", "doublesBack"].includes(lesson.diagram);
  const toPoint = (x: number, y: number) => ({ x: ((x - 27) / 136) * W, y: ((240 - y) / 220) * LEN });
  const tactic: Tactic = {
    v: 1,
    title: `${lesson.id} ${lesson.title}`,
    frames: [
      {
        players: layout.players.map(([x, y], i) => ({ id: i + 1, ...toPoint(x, y) })),
        paths: layout.shots.map(([x, y, a, b]) => ({ from: toPoint(x, y), to: toPoint(a, b) })),
        note: `${sequence ? "示例球路；按教案解读" : "球路为备选或合作方向，不代表连续回合"}。${lesson.objective}`.slice(
          0,
          200,
        ),
      },
    ],
  };
  return (
    <section className={s.panel} aria-label="交互场地图">
      <div className={s.spread}>
        <h2>2D 场地演示</h2>
        <span className={s.tag}>{layout.name}</span>
      </div>
      <p className={s.muted}>拖动球员或目标区调整布置；选中后可用方向键移动。</p>
      <svg
        ref={svg}
        className={s.interactiveCourt}
        viewBox="0 0 190 264"
        role="group"
        aria-label={`${lesson.title}可编辑场地图`}
        onPointerMove={move}
        onPointerUp={endDrag}
        onPointerCancel={() => {
          if (drag.current) {
            setLayout(drag.current.start);
            drag.current = null;
          }
        }}
      >
        <defs>
          <marker id={marker} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0 0L6 3L0 6Z" fill="#f3b665" />
          </marker>
        </defs>
        <rect x="27" y="20" width="136" height="220" fill="#1b503a" stroke="#dfe9d5" />
        <path d="M39 20V240M151 20V240M39 72H151M39 188H151M95 72V188M27 130H163" stroke="#dfe9d5" fill="none" />
        {showZones &&
          layout.zones.map(([x, y, w, h], i) => (
            <g
              key={i}
              tabIndex={0}
              role="button"
              aria-label={`目标区${i + 1}，方向键移动`}
              onPointerDown={(e) => startDrag(e, `zone:${i}`)}
              onFocus={() => setSelected(`zone:${i}`)}
              onKeyDown={(e) => keys(e, `zone:${i}`)}
              className={s.dragItem}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="#d4ee80"
                fillOpacity=".22"
                stroke={selected === `zone:${i}` ? "#fff" : "#cee797"}
                strokeDasharray="3 2"
                strokeWidth={selected === `zone:${i}` ? 2 : 1}
              />
            </g>
          ))}
        {showMoves &&
          layout.moves.map(([x, y, a, b], i) => (
            <path
              key={i}
              d={`M${x} ${y}L${a} ${b}`}
              stroke="#9ac8ff"
              strokeDasharray="4 3"
              strokeWidth="1.5"
              fill="none"
            />
          ))}
        {layout.shots.map(([x, y, a, b], i) => (
          <g key={i} opacity={i === line ? 1 : 0.3} style={{ pointerEvents: "none" }}>
            <path
              d={`M${x} ${y}L${a} ${b}`}
              stroke="#f3b665"
              strokeWidth={i === line ? 2 : 1}
              markerEnd={`url(#${marker})`}
            />
            <text x={(x + a) / 2 + 5} y={(y + b) / 2} fontSize="9" fill="#fff1c8">
              {i + 1}
            </text>
          </g>
        ))}
        {layout.players.map(([x, y, id], i) => (
          <g
            key={id}
            tabIndex={0}
            role="button"
            aria-label={`球员${id}，方向键移动`}
            onPointerDown={(e) => startDrag(e, `player:${i}`)}
            onFocus={() => setSelected(`player:${i}`)}
            onKeyDown={(e) => keys(e, `player:${i}`)}
            className={s.dragItem}
          >
            <circle cx={x} cy={y} r="14" fill="transparent" />
            <circle cx={x} cy={y} r="9" fill={selected === `player:${i}` ? "#d4ee80" : "#f0f3e8"} stroke="#11251a" />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fill="#152919" pointerEvents="none">
              {id}
            </text>
          </g>
        ))}
        {shot && progress > 0 && (
          <circle
            data-testid="demo-ball"
            cx={shot[0] + (shot[2] - shot[0]) * progress}
            cy={shot[1] + (shot[3] - shot[1]) * progress}
            r="3.5"
            fill="#fff38c"
            stroke="#182a17"
            pointerEvents="none"
          />
        )}
      </svg>
      <div className={s.row} style={{ marginTop: 12 }}>
        {layout.shots.map((_, i) => (
          <button className={s.button} key={i} aria-pressed={line === i} onClick={() => chooseLine(i)}>
            球路 {i + 1}
          </button>
        ))}
        <button
          className={`${s.button} ${s.primary}`}
          disabled={!ready || !shot}
          onClick={() => {
            if (playing) setPlaying(false);
            else {
              setProgress(0);
              if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
                setProgress(1);
                setMessage("已按减少动态偏好显示该球路终点。");
              } else setPlaying(true);
            }
          }}
        >
          {playing ? "停止演示" : "播放本条球路"}
        </button>
      </div>
      <p className={s.small} style={{ marginTop: 10 }}>
        {sequence
          ? "逐条查看示例击球方向；本演示不模拟真实弹跳、旋转或自动完成整个回合。"
          : "这些箭头表示备选或合作方向，不自动串成一个连续回合。"}{" "}
        橙线：球路；蓝虚线：移动；浅色框：目标。
      </p>
      <div className={s.inline}>
        <label>
          <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} /> 目标区
        </label>
        <label>
          <input type="checkbox" checked={showMoves} onChange={(e) => setShowMoves(e.target.checked)} /> 移动路线
        </label>
      </div>
      <details className={s.info}>
        <summary>调整布置与站位</summary>
        <label className={s.field} style={{ margin: "15px 0" }}>
          调整对象
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {layout.players.map((p, i) => (
              <option key={p[2]} value={`player:${i}`}>
                球员 {p[2]}
              </option>
            ))}
            {layout.zones.map((_, i) => (
              <option key={i} value={`zone:${i}`}>
                目标区 {i + 1}
              </option>
            ))}
          </select>
        </label>
        <div className={s.row}>
          <button className={s.button} onClick={() => nudge(-3, 0)} aria-label="向左移动">
            ←
          </button>
          <button className={s.button} onClick={() => nudge(0, -3)} aria-label="向上移动">
            ↑
          </button>
          <button className={s.button} onClick={() => nudge(0, 3)} aria-label="向下移动">
            ↓
          </button>
          <button className={s.button} onClick={() => nudge(3, 0)} aria-label="向右移动">
            →
          </button>
          <button className={s.button} onClick={mirror}>
            左右镜像
          </button>
          <button
            className={s.button}
            disabled={!undo}
            onClick={() => {
              if (undo) {
                save(undo);
                setUndo(null);
              }
            }}
          >
            撤销调整
          </button>
          <button className={s.button} onClick={() => change(copy(original))}>
            恢复课程布置
          </button>
        </div>
        <p>站位和目标区可独立调整，原有球路不会自动跟随球员改变。需要修改击球线时，可送到自由战术板继续编辑。</p>
      </details>
      <p className={s.notice} role="status">
        {message}
      </p>
      <Link className={s.button} href={`/board?import=${encodeTactic(tactic)}`}>
        在自由战术板继续编辑 ↗
      </Link>
      <p className={s.muted} style={{ marginTop: 15 }}>
        {original.note}
      </p>
    </section>
  );
}
