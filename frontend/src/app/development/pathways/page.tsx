import { Suspense } from "react";
import DevelopmentPathways from "@/components/coaching/DevelopmentPathways";
export const metadata = { title: "成长路线 · Tennis Agent" };
export default function Page() { return <Suspense fallback={<p>正在打开成长路线…</p>}><DevelopmentPathways /></Suspense>; }
