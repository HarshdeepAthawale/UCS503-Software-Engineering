import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Integration tests against a REAL local Postgres - separate from the default
 * `vitest.config.ts`, which the CI "Test" step runs with no database
 * provisioned. Never wired into `npm test` or CI (T-38 tracks doing that
 * properly, with a Postgres service). Run via `npm run test:integration`
 * after: `docker compose up -d db`, then once ever,
 *   docker compose exec db psql -U nexus -d nexus -c "CREATE DATABASE nexus_test OWNER nexus;"
 *   DATABASE_URL=postgresql://nexus:nexus@localhost:5432/nexus_test?schema=public \
 *     DIRECT_URL=postgresql://nexus:nexus@localhost:5432/nexus_test?schema=public \
 *     node scripts/apply-migrations.mjs
 * Sequential (no parallel workers): every test shares one live database and
 * mints its own unique rows (random UUIDs in emails/names), so tests never
 * collide with each other, but two tests must still not run at once.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
  },
});
