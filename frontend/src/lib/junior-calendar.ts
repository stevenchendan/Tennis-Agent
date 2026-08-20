export type JuniorCategory = "J30" | "J60" | "J100" | "J200" | "J300" | "J500" | "JGS" | "Championship";
export type EventImportance = "tour" | "important";

export interface JuniorEvent {
  id: string;
  name: string;
  category: JuniorCategory;
  importance: EventImportance;
  startDate: string;
  endDate: string;
  country: string;
  region: "Australia/Oceania" | "Asia" | "Europe" | "Americas" | "Africa" | "Global";
  city: string;
  surface?: "Hard" | "Clay" | "Grass" | "Indoor" | "TBC";
  sourceUrl: string;
  lastVerified: string;
  dateStatus: "confirmed" | "to-be-confirmed";
}

export const ITF_JUNIOR_SOURCE = "https://www.itftennis.com/en/tournament-calendar/world-tennis-tour-juniors-calendar/";

// Source-backed seed events. Production sync should replace/refresh this list from ITF's calendar feed.
export const JUNIOR_EVENTS: JuniorEvent[] = [
  { id: "itf-world-championships-2026", name: "ITF World Championships", category: "Championship", importance: "important", startDate: "2026-09-07", endDate: "2026-09-12", country: "TBC", region: "Global", city: "TBC", surface: "TBC", sourceUrl: ITF_JUNIOR_SOURCE, lastVerified: "2026-08-20", dateStatus: "to-be-confirmed" },
  { id: "european-championships-2026", name: "European Junior Championships", category: "Championship", importance: "important", startDate: "2026-09-14", endDate: "2026-09-22", country: "Greece", region: "Europe", city: "Heraklion / Hersonissos", surface: "TBC", sourceUrl: ITF_JUNIOR_SOURCE, lastVerified: "2026-08-20", dateStatus: "confirmed" },
  { id: "panamerican-championships-2026", name: "PanAmerican Championships", category: "Championship", importance: "important", startDate: "2026-09-21", endDate: "2026-09-27", country: "TBC", region: "Americas", city: "TBC", surface: "TBC", sourceUrl: ITF_JUNIOR_SOURCE, lastVerified: "2026-08-20", dateStatus: "to-be-confirmed" },
  { id: "j300-spring-2026", name: "J300 Spring", category: "J300", importance: "tour", startDate: "2026-09-28", endDate: "2026-10-03", country: "USA", region: "Americas", city: "Spring", surface: "Hard", sourceUrl: ITF_JUNIOR_SOURCE, lastVerified: "2026-08-20", dateStatus: "confirmed" },
  { id: "j30-sofia-2026", name: "J30 Sofia", category: "J30", importance: "tour", startDate: "2026-10-26", endDate: "2026-11-01", country: "Bulgaria", region: "Europe", city: "Sofia", surface: "Indoor", sourceUrl: ITF_JUNIOR_SOURCE, lastVerified: "2026-08-20", dateStatus: "confirmed" },
];
