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
  // Prisma runs on the WASM query compiler (`engineType = "client"`, see
  // prisma/schema.prisma). Next's output file tracing follows `import`s, and the
  // client loads that .wasm by PATH at runtime, so tracing never sees it and it
  // was left out of the deployed function. Every query then died with
  //   ENOENT: /var/task/node_modules/.prisma/client/query_compiler_bg.wasm
  // in production while working locally, where node_modules is simply present.
  // Force it into every route's bundle.
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/.prisma/client/*.wasm"],
  },
  experimental: {
    // Keep server-only secrets out of the client bundle.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
