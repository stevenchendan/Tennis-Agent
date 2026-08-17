"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  ScoutingReport,
  TourPlayerHit,
  TourTournament,
  Tour,
  PercentileInfo,
  MyDrawPath,
  ChartingProfile,
} from "@/lib/api";

const SURFACES: { value: string; label: string }[] = [
  { value: "", label: "全部场地" },
  { value: "Clay", label: "红土" },
  { value: "Hard", label: "硬地" },
  { value: "Grass", label: "草地" },
];

const SURFACE_CN: Record<string, string> = { Clay: "红土", Hard: "硬地", Grass: "草地", Carpet: "地毯" };
const LEVEL_CN: Record<string, string> = {
  G: "大满贯", M: "大师赛", PM: "P5/皇冠赛", P: "1000/500", A: "巡回赛",
  W: "总决赛", C: "挑战赛", I: "ITF", D: "国家队", O: "奥运", F: "未来赛",
};

interface Sel {
  player_id: number;
  tour: Tour;
  name: string;
  current_rank?: number | null;
}

function PlayerPicker({
  label,
  value,
  onPick,
  placeholder,
}: {
  label: string;
  value: Sel | null;
  onPick: (p: Sel | null) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TourPlayerHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => {
      api
        .tourPlayers(q.trim())
        .then((r) => {
          setHits(r.slice(0, 8));
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 250);
  }, [q]);

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-neutral-500">{label}</label>
      {value ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm">
          <span className="text-emerald-200">
            {value.name}
            <span className="ml-2 text-xs text-neutral-500">
              {value.tour.toUpperCase()}
              {value.current_rank ? ` · No.${value.current_rank}` : ""}
            </span>
          </span>
          <button className="text-xs text-neutral-500 hover:text-neutral-300" onClick={() => onPick(null)}>
            更换
          </button>
        </div>
      ) : (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-emerald-600"
        />
      )}
      {open && hits.length > 0 && !value && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl">
          {hits.map((h) => (
            <button
              key={`${h.tour}-${h.player_id}`}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-800"
              onClick={() => {
                onPick({ player_id: h.player_id, tour: h.tour, name: h.name, current_rank: h.current_rank });
                setOpen(false);
                setQ("");
              }}
            >
              <span className="text-neutral-100">{h.name}</span>
              <span className="ml-2 text-xs text-neutral-500">
                {h.tour.toUpperCase()}
                {h.current_rank ? ` · No.${h.current_rank}` : ""}
                {h.ioc ? ` · ${h.ioc}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, key_, perc }: { label: string; key_: string; perc: Record<string, PercentileInfo> }) {
  const p = perc[key_];
  if (!p) return null;
  const pct = p.percentile;
  const tone = pct >= 75 ? "bg-rose-500" : pct <= 35 ? "bg-emerald-500" : "bg-neutral-600";
  const note = pct >= 75 ? "巡回赛顶尖" : pct <= 35 ? "巡回赛偏低" : "";
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-neutral-300">{label}</span>
        <span className="tabular-nums text-neutral-100">
          {p.value}
          <span className="ml-1 text-xs text-neutral-500">vs 中位 {p.tour_median}</span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
          <div className={`h-full ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-neutral-500">
          第 {pct} 百分位{note ? ` · ${note}` : ""}
        </span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-emerald-400">{title}</h3>
      {children}
    </section>
  );
}

const RALLY_CN: Record<string, string> = {
  "0_3": "0-3 拍", "4_6": "4-6 拍", "7_9": "7-9 拍", "10p": "10+ 拍",
};

function ServeDirCard({ label, side }: { label: string; side: {
  wide_pct: number | null; body_pct: number | null; t_pct: number | null; serves: number;
} }) {
  const rows: [string, number | null, string][] = [
    ["外角", side.wide_pct, "bg-emerald-500"],
    ["追身", side.body_pct, "bg-neutral-500"],
    ["T 线", side.t_pct, "bg-sky-500"],
  ];
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3.5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-neutral-200">{label}</span>
        <span className="text-[11px] text-neutral-600">{side.serves} 记发球</span>
      </div>
      {rows.map(([name, v, tone]) => (
        <div key={name} className="flex items-center gap-2 py-0.5">
          <span className="w-8 shrink-0 text-xs text-neutral-400">{name}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
            <div className={`h-full ${tone}`} style={{ width: `${Math.max(2, v ?? 0)}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-300">
            {v ?? "—"}%
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartingSections({ chart }: { chart: ChartingProfile }) {
  if (chart.insufficient) {
    return (
      <Section title="微观图表层（落点 / 回合 / 关键分）">
        <p className="text-sm text-neutral-500">
          图表化比赛不足（{chart.sample_matches ?? 0} 场），本板块基于样本太少已隐藏；
          宏观层统计不受影响。数据来源：社区逐分图表化项目（覆盖约 1.7k 名球员）。
        </p>
      </Section>
    );
  }
  const sd = chart.serve_direction;
  const rally = chart.rally;
  return (
    <>
      {sd && (
        <Section title={`发球落点（图表化 ${chart.sample_matches} 场）`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sd.first?.deuce && <ServeDirCard label="一发 · 平分区" side={sd.first.deuce} />}
            {sd.first?.ad && <ServeDirCard label="一发 · 占先区" side={sd.first.ad} />}
            {sd.second?.deuce && <ServeDirCard label="二发 · 平分区" side={sd.second.deuce} />}
            {sd.second?.ad && <ServeDirCard label="二发 · 占先区" side={sd.second.ad} />}
          </div>
          {chart.note && <p className="mt-2 text-[11px] text-amber-500/70">{chart.note}</p>}
        </Section>
      )}
      {rally && (
        <Section title={`回合结构（图表化 ${chart.sample_matches} 场）`}>
          <div className="space-y-2">
            {Object.entries(rally)
              .sort(([a], [b]) => ["0_3", "4_6", "7_9", "10p"].indexOf(a) - ["0_3", "4_6", "7_9", "10p"].indexOf(b))
              .map(([bucket, d]) => (
                <div key={bucket} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 text-neutral-300">{RALLY_CN[bucket] ?? bucket}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className={`h-full ${d.win_pct != null && d.win_pct >= 50 ? "bg-emerald-500" : "bg-rose-500"}`}
                      style={{ width: `${Math.max(2, d.win_pct ?? 0)}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right tabular-nums text-neutral-200">
                    {d.win_pct ?? "—"}%
                  </span>
                  <span className="hidden w-40 shrink-0 text-right text-xs tabular-nums text-neutral-500 sm:block">
                    {d.pts} 分 · 制胜 {d.winners} / UE {d.unforced}
                  </span>
                </div>
              ))}
          </div>
          {chart.first_strike?.won_lte3_share_of_won_pct != null && (
            <p className="mt-3 text-xs text-neutral-400">
              前三拍解决倾向：他赢得的分里{" "}
              <b className="text-emerald-400">{chart.first_strike.won_lte3_share_of_won_pct}%</b>{" "}
              在 3 拍以内结束。
            </p>
          )}
        </Section>
      )}
      {(chart.net || chart.key_points_serve || chart.return_depth || chart.wings) && (
        <Section title={`微观指标（图表化 ${chart.sample_matches} 场）`}>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {chart.net && (
              <>
                <Kpi label="网前频率" value={fmt(chart.net.net_freq_pct, "%")} sub={`得分率 ${fmt(chart.net.net_win_pct, "%")}`} />
                <Kpi label="网前被穿越" value={fmt(chart.net.passed_pct, "%")} />
              </>
            )}
            {chart.key_points_serve && (
              <>
                <Kpi
                  label="破发点一发成功率"
                  value={fmt(chart.key_points_serve.bp_first_in_pct, "%")}
                  sub={`vs 全场 ${fmt(chart.key_points_serve.overall_first_in_pct, "%")}`}
                />
                <Kpi
                  label="破发点保发率"
                  value={fmt(chart.key_points_serve.bp_won_pct, "%")}
                  sub={`${chart.key_points_serve.bp_pts ?? 0} 个破发点`}
                />
              </>
            )}
            {chart.return_depth && (
              <>
                <Kpi
                  label="接发回球深度"
                  value={`${fmt(chart.return_depth.deep_pct, "%")} 深`}
                  sub={`超深 ${fmt(chart.return_depth.very_deep_pct, "%")} · 浅 ${fmt(chart.return_depth.shallow_pct, "%")}`}
                />
                <Kpi label="接发失误率" value={fmt(chart.return_depth.return_error_pct, "%")} />
              </>
            )}
            {chart.wings && chart.wings.ue_share_fh_pct != null && (
              <Kpi
                label="非受迫失误分布"
                value={`正手 ${chart.wings.ue_share_fh_pct}%`}
                sub={`反手 ${Math.round(100 - chart.wings.ue_share_fh_pct)}%`}
              />
            )}
          </div>
        </Section>
      )}
    </>
  );
}

function fmt(v: number | null | undefined, suffix = ""): string {
  return v == null ? "—" : `${v}${suffix}`;
}

export default function ScoutingPage() {
  const [opponent, setOpponent] = useState<Sel | null>(null);
  const [client, setClient] = useState<Sel | null>(null);
  const [surface, setSurface] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [months, setMonths] = useState(12);
  const [includeSecondary, setIncludeSecondary] = useState(false);
  const [tournaments, setTournaments] = useState<TourTournament[]>([]);
  const [report, setReport] = useState<ScoutingReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [drawData, setDrawData] = useState<MyDrawPath | null>(null);
  const [drawBusy, setDrawBusy] = useState(false);

  useEffect(() => {
    api.tourStatus().then(setStatus).catch(() => setStatus({ built: false }));
    api.tourTournaments().then(setTournaments).catch(() => setTournaments([]));
  }, []);

  // 选中赛事后拉取签表（带我方球员则附路径与下轮候选）
  useEffect(() => {
    if (!tournamentId || !opponent) {
      setDrawData(null);
      return;
    }
    let cancelled = false;
    setDrawBusy(true);
    api
      .tourDraw(tournamentId, opponent.tour, client && client.tour === opponent.tour ? client.player_id : undefined)
      .then((r) => !cancelled && setDrawData("status" in r ? (r as MyDrawPath) : null))
      .catch(() => !cancelled && setDrawData(null))
      .finally(() => !cancelled && setDrawBusy(false));
    return () => {
      cancelled = true;
    };
  }, [tournamentId, opponent, client]);

  const tOptions = useMemo(() => {
    const list = tournaments.filter((t) => (opponent ? t.tour === opponent.tour : true));
    list.sort((a, b) => a.tourney_name.localeCompare(b.tourney_name, "zh"));
    return list;
  }, [tournaments, opponent]);

  async function run() {
    if (!opponent) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.tourScouting({
        opponent_id: opponent.player_id,
        tour: opponent.tour,
        client_id: client && client.tour === opponent.tour ? client.player_id : null,
        surface: surface || null,
        tournament_id: tournamentId || null,
        months,
        include_secondary: includeSecondary,
      });
      setReport(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const o = report?.opponent;
  const wl = (report?.surface_stats ?? report?.window_stats)?.win_loss as
    | { matches?: number; wins?: number; losses?: number; win_pct?: number; tb_w?: number; tb_l?: number; tb_win_pct?: number; deciding_w?: number; deciding_l?: number; deciding_win_pct?: number; vs_top10?: { matches: number; wins: number }; vs_top50?: { matches: number; wins: number } }
    | undefined;
  const form = report?.recent_form?.last10 as
    | { wins?: number; losses?: number; streak?: number; best_win_rank?: number; avg_rank_lost_to?: number }
    | undefined;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="no-print mb-2 flex items-center justify-between">
        <p className="text-xs font-medium tracking-widest text-emerald-400">
          SCOUTING · ATP / WTA / ITF
        </p>
        <div className="flex items-center gap-4">
          {report && (
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition hover:border-emerald-600 hover:text-emerald-300"
            >
              打印 / 存 PDF
            </button>
          )}
          <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
            ← 返回首页
          </Link>
        </div>
      </div>
      <h1 className="text-3xl font-bold text-neutral-50">职业球探报告</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
        选择你的对手（可选我方球员生成交手记录），设定比赛场地与赛事。
        报告基于官方记分数据（1968 至今 74 万场比赛）计算高阶指标：
        保发/破发率、统治率、发球与接发分项、巡回赛百分位、关键分表现、负荷状态。
      </p>

      {status && status.built === false && (
        <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          巡回赛资料库尚未构建：在后端运行 <code className="rounded bg-neutral-800 px-1">python scripts/tour_sync.py</code>
          （首次约 3-5 分钟，下载 240MB 归档并建库）。
        </p>
      )}

      {/* 配置区 */}
      <div className="no-print mt-6 grid gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 md:grid-cols-2">
        <PlayerPicker label="对手 *" value={opponent} onPick={setOpponent} placeholder="搜索对手姓名（如 Alcaraz / Swiatek / 张之臻）" />
        <PlayerPicker label="我方球员（可选，生成 H2H）" value={client} onPick={setClient} placeholder="搜索我方球员姓名" />

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">场地</label>
          <div className="flex gap-2">
            {SURFACES.map((s) => (
              <button
                key={s.value}
                onClick={() => setSurface(s.value)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  surface === s.value
                    ? "bg-emerald-500 font-medium text-neutral-950"
                    : "border border-neutral-700 text-neutral-300 hover:border-emerald-700"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">赛事（可选，带出场馆历史）</label>
          <select
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-600"
          >
            <option value="">不指定</option>
            {tOptions.map((t) => (
              <option key={t.tourney_id} value={t.tourney_id}>
                {t.tourney_name}（{SURFACE_CN[t.surface ?? ""] ?? t.surface ?? "?"}）
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">统计窗口</label>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            >
              <option value={6}>近 6 个月</option>
              <option value={12}>近 12 个月</option>
              <option value={24}>近 24 个月</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={includeSecondary}
              onChange={(e) => setIncludeSecondary(e.target.checked)}
              className="accent-emerald-500"
            />
            纳入挑战赛/ITF
          </label>
        </div>

        <div className="flex items-end">
          <button
            onClick={run}
            disabled={!opponent || busy}
            className="w-full rounded-xl bg-emerald-500 px-6 py-2.5 font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "正在生成报告…" : "生成球探报告"}
          </button>
        </div>
      </div>

      {/* 签表面板：选了赛事后出现 */}
      {tournamentId && (
        <div className="no-print mt-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <h3 className="mb-1 text-sm font-semibold tracking-wide text-emerald-400">
            签表 · 下一轮对手
          </h3>
          {drawBusy && <p className="mt-2 text-sm text-neutral-500">读取签表…</p>}
          {!drawBusy && !drawData && (
            <p className="mt-2 text-sm text-neutral-500">该赛事暂无签表数据。</p>
          )}
          {drawData && (
            <div className="mt-2 space-y-3">
              <p className="text-xs text-neutral-500">
                {drawData.draw.info.name} ·{" "}
                {drawData.draw.completed ? "已完赛" : `进行中（存活 ${drawData.draw.alive.length} 人）`}
                {drawData.status === "alive" && drawData.next_round &&
                  ` · 我方打进 ${drawData.last_round}，下一轮 ${drawData.next_round}`}
                {drawData.status === "eliminated" && ` · 我方止步 ${drawData.last_round}`}
              </p>
              {drawData.status && drawData.status !== "not_in_draw" &&
                drawData.my_matches && drawData.my_matches.length > 0 && (
                <div className="text-sm">
                  <div className="mb-1 text-xs text-neutral-500">我方路径：</div>
                  <div className="flex flex-wrap gap-2">
                    {drawData.my_matches.map((m, i) => (
                      <span
                        key={i}
                        className={`rounded-lg border px-2.5 py-1 text-xs ${
                          m.won
                            ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                            : "border-rose-900 bg-rose-950/30 text-rose-300"
                        }`}
                      >
                        {m.round} {m.won ? "胜" : "负"}{" "}
                        {m.won ? m.loser : m.winner} <span className="text-neutral-500">{m.score}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!drawData.draw.completed &&
                (drawData.next_opponent_candidates?.length ?? 0) > 0 && (
                <div className="text-sm">
                  <div className="mb-1 text-xs text-neutral-500">
                    下一轮潜在对手（点击直接生成球探报告）：
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {drawData.next_opponent_candidates!.map((p) => (
                      <button
                        key={p.player_id}
                        onClick={() => {
                          setOpponent({
                            player_id: p.player_id,
                            tour: drawData.draw.info.tour as Tour,
                            name: p.name,
                            current_rank: p.rank,
                          });
                        }}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition hover:border-emerald-600 hover:text-emerald-300"
                      >
                        {p.name}
                        {p.rank ? <span className="ml-1 text-neutral-500">({p.rank})</span> : null}
                      </button>
                    ))}
                  </div>
                  {drawData.candidates_note && (
                    <p className="mt-1 text-[11px] text-neutral-600">{drawData.candidates_note}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {err && <p className="mt-4 text-sm text-red-400">{err}</p>}

      {report && o && (
        <div className="mt-6 space-y-5">
          {/* 选手快照 */}
          <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 p-5">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-2xl font-bold text-neutral-50">{o.name}</h2>
              <span className="text-sm text-neutral-400">
                {o.tour.toUpperCase()} · {o.hand === "L" ? "左手" : "右手"}
                {o.height ? ` · ${o.height}cm` : ""}{o.age ? ` · ${o.age}岁` : ""}{o.ioc ? ` · ${o.ioc}` : ""}
              </span>
              <span className="ml-auto text-sm text-neutral-300">
                当前排名 <b className="text-emerald-400">{o.current_rank ?? "—"}</b>
                {o.peak_rank ? <span className="ml-2 text-neutral-500">峰值 No.{o.peak_rank}</span> : null}
              </span>
              {o.elo && (
                <span className="text-sm text-neutral-300">
                  Elo <b className="text-emerald-400">{Math.round(o.elo.elo_overall)}</b>
                  <span className="ml-1 text-xs text-neutral-500">（{o.tour.toUpperCase()} 第 {o.elo.elo_rank}）</span>
                </span>
              )}
            </div>
            {report.style_tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {report.style_tags.map((t) => (
                  <span
                    key={t.tag}
                    title={t.why}
                    className="rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-xs text-emerald-300"
                  >
                    {t.tag}
                  </span>
                ))}
              </div>
            )}
            {report.context.tournament && (
              <p className="mt-3 text-xs text-neutral-500">
                上下文：{report.context.tournament.tourney_name}
                {report.context.surface ? ` · ${SURFACE_CN[report.context.surface] ?? report.context.surface}` : ""}
              </p>
            )}
          </section>

          {/* 战绩速览 */}
          <Section title="战绩速览（统计窗口内）">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Kpi label="胜负" value={wl ? `${wl.wins ?? 0}-${wl.losses ?? 0}` : "—"} sub={wl?.win_pct ? `胜率 ${wl.win_pct}%` : undefined} />
              <Kpi label="近 10 场" value={form ? `${form.wins ?? 0}-${form.losses ?? 0}` : "—"} sub={form?.streak ? (form.streak > 0 ? `${form.streak} 连胜` : `${-form.streak} 连败`) : undefined} />
              <Kpi label="抢七" value={wl ? `${wl.tb_w ?? 0}-${wl.tb_l ?? 0}` : "—"} sub={wl?.tb_win_pct ? `${wl.tb_win_pct}%` : undefined} />
              <Kpi label="决胜盘" value={wl ? `${wl.deciding_w ?? 0}-${wl.deciding_l ?? 0}` : "—"} sub={wl?.deciding_win_pct ? `${wl.deciding_win_pct}%` : undefined} />
              {wl?.vs_top10 && <Kpi label="对 Top10" value={`${wl.vs_top10.wins}-${wl.vs_top10.matches - wl.vs_top10.wins}`} />}
              {wl?.vs_top50 && <Kpi label="对 Top50" value={`${wl.vs_top50.wins}-${wl.vs_top50.matches - wl.vs_top50.wins}`} />}
              {report.fatigue.matches_28d != null && (
                <Kpi label="近 28 天场次" value={String(report.fatigue.matches_28d)} sub={`三盘率 ${report.fatigue.three_setters_30d ?? 0} 场/30天`} />
              )}
              {report.fatigue.rest_days != null && report.fatigue.rest_days >= 0 && (
                <Kpi label="数据末日距最后一场" value={`${report.fatigue.rest_days} 天`} sub={report.fatigue.retirements_90d ? `90 天内 ${report.fatigue.retirements_90d} 次退役` : undefined} />
              )}
            </div>
          </Section>

          {/* 发球 / 接发 / 百分位 */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="发球端（巡回赛百分位）">
              {report.percentiles.hold_pct ? (
                <div className="divide-y divide-neutral-900">
                  <StatRow label="保发率 %" key_="hold_pct" perc={report.percentiles} />
                  <StatRow label="发球分得分率 %" key_="service_points_won_pct" perc={report.percentiles} />
                  <StatRow label="一发成功率 %" key_="first_serve_pct" perc={report.percentiles} />
                  <StatRow label="一发得分率 %" key_="first_serve_won_pct" perc={report.percentiles} />
                  <StatRow label="二发得分率 %" key_="second_serve_won_pct" perc={report.percentiles} />
                  <StatRow label="ACE 率 %" key_="ace_rate_pct" perc={report.percentiles} />
                  <StatRow label="双误率 %" key_="df_rate_pct" perc={report.percentiles} />
                  <StatRow label="救破发点 %" key_="bp_saved_pct" perc={report.percentiles} />
                </div>
              ) : (
                <p className="text-sm text-neutral-500">窗口内完整比赛不足，无法计算发球端指标。</p>
              )}
            </Section>
            <Section title="接发端（巡回赛百分位）">
              {report.percentiles.break_pct ? (
                <div className="divide-y divide-neutral-900">
                  <StatRow label="破发率 %" key_="break_pct" perc={report.percentiles} />
                  <StatRow label="接发得分率 %" key_="return_points_won_pct" perc={report.percentiles} />
                  <StatRow label="接一发得分率 %" key_="return_vs_first_pct" perc={report.percentiles} />
                  <StatRow label="接二发得分率 %" key_="return_vs_second_pct" perc={report.percentiles} />
                  <StatRow label="兑现破发点 %" key_="bp_converted_pct" perc={report.percentiles} />
                  <StatRow label="统治率 DR" key_="dominance_ratio" perc={report.percentiles} />
                </div>
              ) : (
                <p className="text-sm text-neutral-500">窗口内完整比赛不足，无法计算接发端指标。</p>
              )}
            </Section>
          </div>

          {/* 分场地 */}
          {Object.keys(report.surface_split).length > 0 && (
            <Section title="场地基因（近 36 个月）">
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(report.surface_split).map(([s, d]) => (
                  <div key={s} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="font-medium text-neutral-200">{SURFACE_CN[s] ?? s}</span>
                      <span className="text-xs text-neutral-500">{d.matches} 场</span>
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-emerald-400">
                      {d.win_pct ?? "—"}<span className="text-sm text-neutral-500">%</span>
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-neutral-400">
                      保发 {d.hold_pct ?? "—"}% · 破发 {d.break_pct ?? "—"}%
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 微观图表层 */}
          {report.charting && <ChartingSections chart={report.charting} />}

          {/* H2H / 场馆 */}
          {(report.h2h || report.venue) && (
            <div className="grid gap-5 lg:grid-cols-2">
              {report.h2h && (
                <Section title={`交手记录（我方 ${report.h2h.wins}-${report.h2h.losses}）`}>
                  <ul className="space-y-1.5 text-sm">
                    {report.h2h.list.slice(0, 8).map((m, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className={`w-8 shrink-0 text-center text-xs font-bold ${m.won ? "text-emerald-400" : "text-rose-400"}`}>
                          {m.won ? "胜" : "负"}
                        </span>
                        <span className="w-16 shrink-0 tabular-nums text-xs text-neutral-500">{m.date}</span>
                        <span className="flex-1 truncate text-neutral-300">{m.tournament}</span>
                        <span className="tabular-nums text-xs text-neutral-400">{m.score}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {report.venue && (
                <Section title={`${report.venue.tournament.tourney_name} 历史战绩（${report.venue.wins}-${report.venue.losses}）`}>
                  <ul className="space-y-1.5 text-sm">
                    {report.venue.list.slice(0, 8).map((m, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className={`w-8 shrink-0 text-center text-xs font-bold ${m.won ? "text-emerald-400" : "text-rose-400"}`}>
                          {m.won ? "胜" : "负"}
                        </span>
                        <span className="w-16 shrink-0 tabular-nums text-xs text-neutral-500">{m.date}</span>
                        <span className="flex-1 truncate text-neutral-300">{m.opp_name}（{m.round}）</span>
                        <span className="tabular-nums text-xs text-neutral-400">{m.score}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}

          {/* 战术建议 */}
          {report.tactics.length > 0 && (
            <Section title="战术建议（规则引擎 · 每条含证据）">
              <div className="grid gap-3 md:grid-cols-2">
                {report.tactics.map((t, i) => (
                  <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                    <div className="font-medium text-neutral-100">{t.title}</div>
                    <div className="mt-1 text-xs text-emerald-500/80">{t.evidence}</div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">{t.detail}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 近期比赛 */}
          <Section title="近期比赛（15 场）">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                    <th className="py-2 pr-3">日期</th>
                    <th className="py-2 pr-3">赛事</th>
                    <th className="py-2 pr-3">轮次</th>
                    <th className="py-2 pr-3">对手</th>
                    <th className="py-2 pr-3">比分</th>
                    <th className="py-2 pr-3">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recent_matches.map((m, i) => (
                    <tr key={i} className="border-b border-neutral-900">
                      <td className="py-1.5 pr-3 tabular-nums text-neutral-400">{m.date}</td>
                      <td className="py-1.5 pr-3 text-neutral-300">
                        {m.tournament}
                        <span className="ml-1 text-xs text-neutral-600">
                          {LEVEL_CN[m.level] ?? ""} · {SURFACE_CN[m.surface] ?? m.surface}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-xs text-neutral-500">{m.round}</td>
                      <td className="py-1.5 pr-3 text-neutral-300">
                        {m.opponent}
                        {m.opponent_rank ? <span className="ml-1 text-xs text-neutral-600">({m.opponent_rank})</span> : null}
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums text-neutral-400">{m.score}</td>
                      <td className={`py-1.5 pr-3 text-xs font-bold ${m.won ? "text-emerald-400" : "text-rose-400"}`}>
                        {m.won ? "胜" : "负"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <p className="pb-6 text-xs leading-relaxed text-neutral-600">
            数据来源：ATP/WTA/ITF 官方记分系统导出的开放归档（1968 至今，含逐项发球统计与周级排名），
            共 {String(status?.matches ?? "—")} 场比赛。统计窗口 {report.data_window.from} ~ {report.data_window.to}，
            建库时间 {report.data_window.synced_at}。保发/破发率为基于破发点的估计值（数据集通行口径）；
            完整完赛场次才计入比率。百分位人群 = 同巡回赛同窗口发球分 ≥800 的球员。
          </p>
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2.5">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-bold tabular-nums text-neutral-100">{value}</div>
      {sub && <div className="text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}
