/**
 * Point Cursor at the mattpocock skill tree without duplicating files.
 * Windows: directory junction. POSIX: symlink.
 *
 *   node scripts/link-cursor-skills.mjs
 */
import { existsSync, lstatSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, ".cursor", "skills");
const src = join(root, ".agents", "skills");

if (!existsSync(src)) {
  console.error("Missing .agents/skills — run `npx skills add mattpocock/skills` first.");
  process.exit(1);
}

if (existsSync(dest)) {
  const st = lstatSync(dest);
  const isLink = st.isSymbolicLink() || (process.platform === "win32" && st.isDirectory());
  if (!isLink) {
    console.error(`${dest} exists and is not a link. Move it aside, then re-run.`);
    process.exit(1);
  }
  // rmdir the junction/symlink only — never recursive (that can wipe .agents/skills).
  spawnSync(process.platform === "win32" ? "cmd" : "rm", process.platform === "win32" ? ["/c", "rmdir", dest] : [dest], {
    stdio: "inherit",
  });
}

if (process.platform === "win32") {
  const r = spawnSync("cmd", ["/c", "mklink", "/J", dest, src], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const r = spawnSync("ln", ["-s", src, dest], { stdio: "inherit" });
process.exit(r.status ?? 1);
