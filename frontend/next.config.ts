import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep a parallel review preview separate from the main dev/build output.
  distDir: process.env.TENNIS_BUILD_DIR || ".next",
};

export default nextConfig;
