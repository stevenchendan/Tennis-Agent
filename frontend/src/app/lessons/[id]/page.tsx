import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lessons, findLesson } from "@/lib/coaching/catalog";
import LessonWorkspace from "@/components/coaching/LessonWorkspace";
export function generateStaticParams() {
  return lessons.map((l) => ({ id: l.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const l = findLesson(id);
  return { title: l ? `${l.title} · 教案${id}` : "教案未找到" };
}
export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = findLesson(id);
  if (!l) notFound();
  return <LessonWorkspace key={l.id} lesson={l} />;
}
