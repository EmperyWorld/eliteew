import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Avoid picking EliteEW/pnpm-lock.yaml as monorepo root for file tracing.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
