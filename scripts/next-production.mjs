#!/usr/bin/env node
/**
 * Runs `next <command>` with NODE_ENV pinned to "production".
 *
 * Why this exists
 * ---------------
 * The Render deploy failed every build with:
 *
 *   Error: <Html> should not be imported outside of pages/_document.
 *   Export encountered an error on /_error: /500, exiting the build.
 *
 * Nothing imports `next/document` and there is no `pages/` directory. The cause
 * is `NODE_ENV=development` being set in the deploy environment: `next build`
 * then wires up the Pages-router DEV error document to satisfy /_error, and
 * prerendering that is what throws. Reproduced locally with
 * `NODE_ENV=development next build` — identical failure — and it builds clean
 * the moment NODE_ENV is production.
 *
 * `next build` and `next start` are production operations by definition, so
 * pinning the value here (rather than trusting whatever the host exports) makes
 * the build reproducible instead of dependent on dashboard configuration. It
 * also closes a quieter hole: a server running with NODE_ENV=development skips
 * the production guards in `src/lib/env.ts`, which is how insecure cookies could
 * have been allowed in a deployed environment.
 *
 * Set as a script rather than an inline `NODE_ENV=production next build` so it
 * works on Windows (PowerShell has no inline env-var prefix) as well as Linux.
 *
 * Runtime pin: `.node-version` is 22, not the 24 this was first written against.
 * Render accepts either, but Vercel treats `.node-version` as an exact pin and
 * offers no 24 runtime, so the frontend deploy failed on it. 22 is current LTS
 * and is satisfied by the `engines` range in package.json, so both hosts and a
 * local Node 24 all agree.
 *
 * NOTE: with NODE_ENV correct, `ALLOW_INSECURE_COOKIES` is now actually checked
 * at build time. If the deploy still has it set to "true", the build will fail
 * loudly with "ALLOW_INSECURE_COOKIES must be false in production" — that guard
 * is working as intended; set the variable to false.
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/next-production.mjs <next-command> [...args]");
  process.exit(1);
}

const result = spawnSync("next", args, {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
  // Windows resolves `next` to next.cmd, which needs a shell to execute.
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
