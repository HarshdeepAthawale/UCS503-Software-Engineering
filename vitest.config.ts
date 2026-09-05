import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // tests/integration/** needs a live Postgres (see vitest.integration.config.ts
    // + `npm run test:integration`) - CI's `npm test` step provisions no
    // database, so these must never be swept into the default run.
    exclude: ["tests/integration/**", "node_modules/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
