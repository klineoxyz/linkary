import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Hide dev indicator to avoid nextjs-portal offset (e.g. 8px) affecting layout */
  devIndicators: false,
};

export default nextConfig;
