#!/usr/bin/env node
/**
 * (Re)create the local DEMO database and fill it: drop + create `nexus_demo`,
 * apply every migration, then run prisma/seed-demo.ts.
 *
 *   npm run demo:setup
 *
 * Reads DATABASE_URL and DEMO_PASSWORD from .env.demo.local (see package.json).
 * Refuses anything but a local database named nexus_demo - the real `nexus`
 * database, the test database and production are never touched.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL ?? "");
if (url.pathname !== "/nexus_demo" || !["localhost", "127.0.0.1"].includes(url.hostname)) {
  console.error("demo:setup only runs against a local database named nexus_demo.");
  process.exit(1);
}

const admin = new URL(url);
admin.pathname = "/postgres";
admin.search = "";
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
await client.query("DROP DATABASE IF EXISTS nexus_demo WITH (FORCE)");
await client.query("CREATE DATABASE nexus_demo");
await client.end();
console.log("nexus_demo recreated");

function run(args) {
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
run(["scripts/apply-migrations.mjs"]);
run(["--import", "tsx", "prisma/seed-demo.ts"]);
