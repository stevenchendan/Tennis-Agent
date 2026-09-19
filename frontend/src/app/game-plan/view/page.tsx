import type { Metadata } from "next";
import SharedPlan from "@/components/game-plan/SharedPlan";
export const metadata: Metadata = { title: "Player Brief | Tennis Agent", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <SharedPlan/>; }
