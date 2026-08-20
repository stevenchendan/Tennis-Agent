export type UtrRatingType = "verified" | "unverified" | "estimated";

export interface UtrBenchmark {
  playerId: string;
  displayName: string;
  rating: number;
  ratingType: UtrRatingType;
  singlesOrDoubles: "singles" | "doubles";
  asOf: string;
  source: "utr-engage-api" | "official-import";
  sourceUrl?: string;
  consented: boolean;
}

export function benchmarkIsUsable(value: UtrBenchmark | null): boolean {
  return Boolean(value && value.consented && value.ratingType !== "estimated" && Number.isFinite(value.rating));
}

export function freshnessLabel(asOf: string, now = new Date()): "fresh" | "stale" | "unknown" {
  const date = new Date(`${asOf}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "unknown";
  const ageDays = (now.getTime() - date.getTime()) / 86_400_000;
  return ageDays <= 31 ? "fresh" : "stale";
}
