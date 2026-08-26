"use client";

import { useEffect, useState } from "react";

/**
 * Theme toggle — dark-first with a per-viewer preference persisted in
 * localStorage (guarded). Explicit choice stamps `data-theme` on <html>;
 * the CSS token blocks in globals.css handle both directions and the
 * un-stamped "system" state (prefers-color-scheme).
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Hydrate from the stored choice (fall back to the OS preference).
    try {
      const saved = localStorage.getItem("nexus-theme");
      const initial =
        saved === "light" || saved === "dark"
          ? saved
          : window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
    } catch {
      // localStorage unavailable (private mode / blocked) — stay dark-first.
    }
  }, []);

  const toggle = () => {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("nexus-theme", next);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      aria-label="Toggle colour theme"
      title="Toggle theme"
    >
      ◐
    </button>
  );
}
