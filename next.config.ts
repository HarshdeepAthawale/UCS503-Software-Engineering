import type { NextConfig } from "next";

/**
 * Security-relevant Next.js configuration.
 * - `poweredByHeader: false` removes the X-Powered-By fingerprinting header.
 * - `reactStrictMode` surfaces unsafe lifecycle usage early.
 * Response security headers (CSP, HSTS, etc.) are set centrally in `src/middleware.ts`
 * so they apply uniformly to API routes as well as pages.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keep server-only secrets out of the client bundle.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
