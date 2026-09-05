#!/usr/bin/env node
/**
 * Fresh production-like Docker image (runner stage) with no stale .next volume.
 * Usage: npm run docker:prod
 */
import { spawnSync } from "node:child_process";

const cachebust = String(Date.now());
const compose = ["compose", "-f", "docker-compose.prod.yml"];

function run(args, inherit = false) {
  const result = spawnSync("docker", args, {
    stdio: inherit ? "inherit" : "pipe",
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    if (!inherit && result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result;
}

run([...compose, "down"]);
run([
  ...compose,
  "build",
  "--no-cache",
  "--build-arg",
  `CACHEBUST=${cachebust}`,
]);
run([...compose, "up"], true);
