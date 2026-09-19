import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export const situations = ["serve", "return", "rally"] as const;
export type Situation = typeof situations[number];
export const attachmentIds = ["aggressive-baseliner", "patient-baseliner", "counterpuncher", "big-server", "serve-volley", "all-court"] as const;
export type Plan = {
  version: 1; id: string; updatedAt: string; title: string; player: string; author: string;
  opponent: string; date: string; surface: string; objective: string;
  observations: string; evidence: "Unconfirmed" | "Player report" | "Coach observation" | "Video review";
  priorities: [string, string, string];
  situations: Record<Situation, { primary: string; trigger: string; fallback: string }>;
  reset: string; preparation: string; message: string; attachments: string[];
};
export const PLAN_STORAGE = "tennis-agent:match-plans:v1";
export const MAX_LINK_LENGTH = 18000;
export function emptyPlan(): Plan {
  return {
    version: 1, id: crypto.randomUUID(), updatedAt: new Date().toISOString(), title: "", player: "", author: "", opponent: "", date: "", surface: "Hard",
    objective: "", observations: "", evidence: "Unconfirmed", priorities: ["", "", ""],
    situations: { serve: { primary: "", trigger: "", fallback: "" }, return: { primary: "", trigger: "", fallback: "" }, rally: { primary: "", trigger: "", fallback: "" } },
    reset: "", preparation: "", message: "", attachments: [],
  };
}
export function starterPlan(): Plan {
  return { ...emptyPlan(), title: "Build the point with margin", objective: "Create a balanced attacking opportunity before changing direction.",
    priorities: ["Choose a generous target.", "Recover before the next contact.", "Attack a short ball only when balanced."],
    situations: {
      serve: { primary: "Use a reliable serve location, then look for a balanced first groundstroke.", trigger: "The return arrives deep or at my feet.", fallback: "Send the next ball deep through the middle and rebuild." },
      return: { primary: "Return with margin toward a large deep target.", trigger: "I am stretched or late on the serve.", fallback: "Use a compact reply into the court; recover before looking to attack." },
      rally: { primary: "Build cross-court until a shorter ball gives time to step in.", trigger: "I am off balance or the opponent keeps good depth.", fallback: "Keep the diagonal with extra margin and restore position." },
    }, reset: "Turn away, breathe out, choose one target, commit to the next point.",
    preparation: "Warm up the intended serve location and cross-court target. Rehearse one Plan B before starting.",
    message: "This starter is a draft. Adapt it to the player's skills, observations and match conditions.", attachments: ["patient-baseliner"],
  };
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function parsePlan(value: unknown): Plan | null {
  if (!record(value) || value.version !== 1) return null;
  const fields = ["id", "updatedAt", "title", "player", "author", "opponent", "date", "surface", "objective", "observations", "reset", "preparation", "message"] as const;
  if (fields.some(key => typeof value[key] !== "string" || (value[key] as string).length > 600)) return null;
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(value.id as string) || !Number.isFinite(Date.parse(value.updatedAt as string))) return null;
  if (!["Hard", "Clay", "Grass", "Indoor", "Other"].includes(value.surface as string)) return null;
  if (value.date !== "" && (!/^\d{4}-\d{2}-\d{2}$/.test(value.date as string) || !Number.isFinite(Date.parse(value.date as string)))) return null;
  if (!["Unconfirmed", "Player report", "Coach observation", "Video review"].includes(value.evidence as string)) return null;
  if (!Array.isArray(value.priorities) || value.priorities.length !== 3 || value.priorities.some(v => typeof v !== "string" || v.length > 180)) return null;
  if (!Array.isArray(value.attachments) || value.attachments.length > 3 || value.attachments.some(v => !attachmentIds.includes(v)) || new Set(value.attachments).size !== value.attachments.length) return null;
  if (!record(value.situations)) return null;
  const plans = {} as Plan["situations"];
  for (const key of situations) {
    const item = value.situations[key];
    if (!record(item) || ["primary", "trigger", "fallback"].some(k => typeof item[k] !== "string" || (item[k] as string).length > 400)) return null;
    plans[key] = { primary: item.primary as string, trigger: item.trigger as string, fallback: item.fallback as string };
  }
  // Rebuild the object so imported data cannot bring extra fields into a shared brief.
  return { version: 1, ...Object.fromEntries(fields.map(key => [key, value[key]])), evidence: value.evidence, priorities: [...value.priorities], attachments: [...value.attachments], situations: plans } as Plan;
}
export function readiness(plan: Plan): string[] {
  const missing: string[] = [];
  if (!plan.title.trim()) missing.push("Plan title");
  if (!plan.player.trim()) missing.push("Player name");
  if (!plan.objective.trim()) missing.push("Match objective");
  if (plan.priorities.some(p => !p.trim())) missing.push("Three priorities");
  for (const key of situations) if (Object.values(plan.situations[key]).some(p => !p.trim())) missing.push(`${key[0].toUpperCase()}${key.slice(1)}: Plan A, switch trigger and Plan B`);
  if (!plan.reset.trim()) missing.push("Between-point reset cue");
  return missing;
}
export function encodePlan(plan: Plan): string {
  const clean = parsePlan(plan);
  if (!clean) throw new Error("The plan contains invalid or oversized fields.");
  const encoded = compressToEncodedURIComponent(JSON.stringify(clean));
  if (encoded.length > MAX_LINK_LENGTH) throw new Error("This plan is too long for a share link. Export it as a file instead.");
  return encoded;
}
export function decodePlan(encoded: string): Plan | null {
  if (!encoded || encoded.length > MAX_LINK_LENGTH) return null;
  try {
    const text = decompressFromEncodedURIComponent(encoded);
    return text && text.length <= 40000 ? parsePlan(JSON.parse(text)) : null;
  } catch { return null; }
}
export function readPlans(raw: string | null): Plan[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Saved plans are not a list.");
  return parsed.map(parsePlan).filter((p): p is Plan => p !== null).slice(0, 20);
}
