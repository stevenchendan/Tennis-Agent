import type { Metadata } from "next";
import MelbourneParkOpenDataExperience from "@/components/venue/MelbourneParkOpenDataExperience";

export const metadata: Metadata = {
  title: "Melbourne Park 3D · Tennis-Agent",
  description: "Explore a self-hosted, open-data 3D reconstruction of Melbourne Park and its tennis courts.",
};

export default function MelbourneParkPage() {
  return <MelbourneParkOpenDataExperience />;
}
