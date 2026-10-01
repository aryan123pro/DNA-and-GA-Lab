import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // no Next.js badge in the corner while developing; errors still surface
  devIndicators: false,
};

export default nextConfig;
