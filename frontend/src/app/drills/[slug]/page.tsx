import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { drills, findDrill } from "@/lib/drills/catalog";
import DrillPlayer from "@/components/drills/DrillPlayer";
export function generateStaticParams() { return drills.map(d => ({ slug: d.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const drill = findDrill((await params).slug);
  return { title: drill ? `${drill.title} | Tennis Lab` : "Drill not found", description: drill?.summary };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const drill = findDrill((await params).slug);
  if (!drill) notFound();
  return <DrillPlayer drill={drill} />;
}
