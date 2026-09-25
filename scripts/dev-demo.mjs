#!/usr/bin/env node
/**
 * Start the dev server against the DEMO database.
 *
 *   npm run dev:demo
 *
 * DATABASE_URL comes from .env.demo.local (loaded by package.json); variables
 * in the process environment win over Next's .env files. Outgoing email and
 * résumé storage are switched off, so demo activity never mails the
 * @example.test accounts or writes files into the real Supabase bucket.
 */
import { spawn } from "node:child_process";

if (!process.env.DATABASE_URL?.includes("/nexus_demo")) {
  console.error("dev:demo expects DATABASE_URL to point at nexus_demo (.env.demo.local).");
  process.exit(1);
}

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", "3000"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DIRECT_URL: process.env.DATABASE_URL,
    RESEND_API_KEY: "",
    EMAIL_FROM: "",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
