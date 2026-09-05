#!/usr/bin/env node
/**
 * Dev Docker stack with volumes cleared — fixes stale .next UI after code changes.
 * Usage: npm run docker:rebuild
 */
import { spawnSync } from "node:child_process";

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

run(["compose", "down", "-v"]);
run(["compose", "build", "--no-cache"]);
run(["compose", "up"], true);
