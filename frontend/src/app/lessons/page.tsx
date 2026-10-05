import { Suspense } from "react";
import type { Metadata } from "next";
import LessonLibrary from "@/components/coaching/LessonLibrary";
export const metadata: Metadata = {
  title: "120节教练教案 · Tennis Agent",
  description: "按水平选择课程，在项目内查看流程、场地与课堂记录。",
};
export default function LessonsPage() {
  return (
    <Suspense fallback={<p>正在打开教案库…</p>}>
      <LessonLibrary />
    </Suspense>
  );
}
