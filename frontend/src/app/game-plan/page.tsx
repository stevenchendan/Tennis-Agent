import type { Metadata } from "next";
import GamePlanWorkspace from "@/components/game-plan/GamePlanWorkspace";
export const metadata: Metadata = { title: "Game Plan | Tennis Agent", description: "Prepare a match plan, brief your player and share a clear strategy for match day." };
export default function Page() { return <GamePlanWorkspace/>; }
