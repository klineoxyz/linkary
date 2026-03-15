import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* Hide dev indicator to avoid nextjs-portal offset (e.g. 8px) affecting layout */
  devIndicators: false,
  /* Fix Turbopack workspace root so Next.js resolves and compiles correctly (avoids "inferred workspace root" issues) */
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
