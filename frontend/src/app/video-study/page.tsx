import type { Metadata } from "next";
import VideoStudy from "@/components/drills/VideoStudy";

export const metadata: Metadata = {
  title: "Court-level Video Study | Tennis Lab",
  description: "Timestamped tennis observations, two adapted practice drills and technique review checkpoints.",
};

export default function Page() { return <VideoStudy />; }
