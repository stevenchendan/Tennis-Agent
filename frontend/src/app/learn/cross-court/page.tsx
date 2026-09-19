import type { Metadata } from "next";
import CrossCourtLesson from "@/components/learning/CrossCourtLesson";

export const metadata: Metadata = {
  title: "Cross-court consistency | Tennis Lab",
  description: "Learn, decide and practise a cross-court pattern at your own level.",
};
export default function Page() { return <CrossCourtLesson />; }
