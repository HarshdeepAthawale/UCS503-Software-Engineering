import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every page names itself in the browser tab, so people with several tabs
 * open can tell them apart (and screen readers announce where they landed).
 * A page gets its title from its own `metadata` or from a layout above it.
 */

const APP = join(process.cwd(), "src", "app");
const hasTitle = (file: string) => existsSync(file) && /export (const metadata\b[^;]*title|(async )?function generateMetadata)/s.test(readFileSync(file, "utf8"));

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    return name === "page.tsx" ? [full] : [];
  });
}

/** The page itself, or any layout between it and the root layout (which only has the default). */
function titled(page: string): boolean {
  if (hasTitle(page)) return true;
  for (let dir = dirname(page); dir !== APP; dir = dirname(dir)) {
    if (hasTitle(join(dir, "layout.tsx"))) return true;
  }
  return false;
}

describe("page titles", () => {
  it("gives every page except the sign-in page its own title", () => {
    const untitled = pages(APP)
      .filter((p) => dirname(p) !== APP) // "/" is the sign-in page and keeps the product name
      .filter((p) => !titled(p))
      .map((p) => "/" + relative(APP, dirname(p)).replace(/\\/g, "/"));
    expect(untitled).toEqual([]);
  });
});
