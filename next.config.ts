import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for minimal production Docker image
  output: "standalone",
};

export default nextConfig;
