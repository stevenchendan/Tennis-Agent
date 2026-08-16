// Typed client for the Tennis-Agent backend (FastAPI).

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type CourtSide = "deuce" | "ad";
export type ShotZone = "service" | "mid" | "deep" | "front";
export type ShotDirection = "cross" | "line" | "middle";
export type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface Shot {
  index: number;
  frame: number;
  time_s: number;
  player_id: number;
  is_serve: boolean;
  is_volley: boolean;
  hit_position: [number, number];
  landing_position: [number, number] | null;
  side: CourtSide | null;
  zone: ShotZone | null;
  direction: ShotDirection | null;
  speed_kmh: number | null;
}

export interface Rally {
  id: number;
  start_frame: number;
  end_frame: number;
  server: number;
  serve_side: CourtSide;
  shots: Shot[];
  winner: number | null;
  end_reason: string | null;
  winner_confidence: number;
}

export type PatternCategory =
  | "serve"
  | "serve_plus_one"
  | "rally"
  | "direction"
  | "position";

export interface PatternCard {
  code: string;
  category: PatternCategory;
  title: string;
  description: string;
  player_id: number | null;
  support: number;
  confidence: number;
  evidence_rally_ids: number[];
  takeaway: string;
}

export interface MatchStats {
  points: number;
  points_won: Record<string, number>;
  shots: Record<string, number>;
  volleys: Record<string, number>;
  avg_rally_length: number;
  longest_rally: number;
  direction_counts: Record<string, Record<string, number>>;
}

export interface AnalysisResult {
  id: string;
  created_at: string;
  source: string;
  mode: string;
  fps: number;
  players: Record<string, string>;
  rallies: Rally[];
  patterns: PatternCard[];
  stats: MatchStats;
  report: string | null;
  report_generated_by: string | null;
  court_mapping: string;
  notes: string[];
}

export interface Stage {
  name: string;
  status: StageStatus;
  detail: string;
}

export interface AnalysisJob {
  id: string;
  mode: string;
  video_id: string | null;
  status: "queued" | "running" | "done" | "failed";
  stages: Stage[];
  error: string | null;
  result: AnalysisResult | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ status: string; llm_enabled: boolean; full_mode_ready: boolean }>("/api/health"),
  createDemoAnalysis: () =>
    req<{ analysis_id: string }>("/api/analyses", {
      method: "POST",
      body: JSON.stringify({ mode: "demo" }),
    }),
  getAnalysis: (id: string) => req<AnalysisJob>(`/api/analyses/${id}`),
  chat: (id: string, message: string) =>
    req<{ answer: string; llm: boolean }>(`/api/analyses/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  uploadVideo: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/videos`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<{ video_id: string }>;
  },
  createFullAnalysis: (video_id: string) =>
    req<{ analysis_id: string }>("/api/analyses", {
      method: "POST",
      body: JSON.stringify({ mode: "full", video_id }),
    }),
};
