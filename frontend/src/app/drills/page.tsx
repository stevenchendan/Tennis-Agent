import { Suspense } from "react";
import type { Metadata } from "next";
import DrillLibrary from "@/components/drills/DrillLibrary";
export const metadata: Metadata = { title: "Drill Library | Tennis Lab", description: "Explore tennis drills with interactive 2D and 3D animations." };
export default function Page() { return <Suspense fallback={<p>Loading drill library…</p>}><DrillLibrary /></Suspense>; }
