export type Drill = {
  id: string;
  slug: string;
  title: string;
  category: "singles" | "doubles";
  level: string;
  players: string;
  tags: string[];
  summary: string;
  animation: "mercy-volley";
};

// Metadata stays separate from the renderer and motion data as the catalog grows.
export const drills: Drill[] = [{
  id: "singles-020",
  slug: "mercy-shot-volleys",
  title: "Mercy Shot · Volleys",
  category: "singles",
  level: "3.0+",
  players: "2 players · P1 & P2",
  tags: ["Volleys", "Transition", "Cross-court", "Net play"],
  summary: "Close the net. Own the angle. Practice your transition volley, then play out the cross-court point.",
  animation: "mercy-volley",
}];

export const findDrill = (slug: string) => drills.find((drill) => drill.slug === slug);
