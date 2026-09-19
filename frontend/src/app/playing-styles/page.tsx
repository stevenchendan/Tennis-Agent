import type { Metadata } from "next";
import PlayingStyles from "@/components/playing-styles/PlayingStyles";
export const metadata: Metadata = { title: "Playing styles | Tennis Lab", description: "Explore six tennis playing styles through synchronized 2D and 3D point demonstrations." };
export default function Page() { return <PlayingStyles />; }
