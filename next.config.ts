import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Custom server (server.ts) with node-cron requires a standard Node.js build.
  // The instrumentation.ts + standalone-output combination is broken (Next.js issue #89377):
  // instrumentation files are excluded from the bundle, so cron jobs never fire in production.
  // Dockerfile runner stage copies full node_modules instead of using standalone output.
};

export default nextConfig;
