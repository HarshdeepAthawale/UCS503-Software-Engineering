"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/client/api";

type Item = { href: string; label: string; hint: string; group: string };

function itemsFor(user: SessionUser | null): Item[] {
  if (!user) {
    return [
      { href: "/", label: "Home", hint: "Landing", group: "Go to" },
      { href: "/product", label: "Product", hint: "What Nexus does", group: "Go to" },
      { href: "/about", label: "About", hint: "Thesis & team", group: "Go to" },
      { href: "/login", label: "Sign in", hint: "Existing account", group: "Account" },
      { href: "/register", label: "Get started", hint: "Create an account", group: "Account" },
      { href: "/errors", label: "HTTP status codes", hint: "API contract", group: "Go to" },
    ];
  }
  const canPost = user.role === "FACULTY" || user.role === "ALUMNI";
  const rows: Item[] = [
    { href: "/opportunities", label: "Opportunities", hint: "Faceted discovery", group: "Go to" },
    { href: "/messages", label: "Messages", hint: "Scoped to applications", group: "Go to" },
    { href: "/notifications", label: "Notifications", hint: "Digest + alerts", group: "Go to" },
    { href: "/profile", label: "Profile", hint: "Skills, résumé, projects", group: "Go to" },
    { href: "/teams", label: "Teams", hint: "Hackathon / project teams", group: "Go to" },
    { href: "/errors", label: "HTTP status codes", hint: "API contract", group: "Go to" },
  ];
  if (user.role === "STUDENT") {
    rows.splice(1, 0, {
      href: "/applications",
      label: "My applications",
      hint: "Pipeline tracker",
      group: "Go to",
    });
    rows.push({ href: "/teams/mine", label: "My teams", hint: "Roles you hold", group: "Go to" });
  }
  if (canPost) {
    rows.push(
      { href: "/opportunities/mine", label: "My postings", hint: "What you published", group: "Go to" },
      { href: "/opportunities/new", label: "Post an opportunity", hint: "Publish with an SLA", group: "Actions" },
    );
  }
  if (user.role === "ADMIN") {
    rows.push({ href: "/admin", label: "Admin console", hint: "Identity & flags", group: "Go to" });
  }
  return rows;
}

/**
 * ⌘K / Ctrl+K launcher. Jump to a screen without hunting the portal bar.
 * Role-filtered; never a security boundary.
 */
export function CommandPalette({ user }: { user: SessionUser | null }) {
  const router = useRouter();
  const [mod, setMod] = useState("Ctrl");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const list = useMemo(() => itemsFor(user), [user]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (i) =>
        i.label.toLowerCase().includes(needle) ||
        i.hint.toLowerCase().includes(needle) ||
        i.group.toLowerCase().includes(needle),
    );
  }, [list, q]);

  useEffect(() => {
    setMod(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl");
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setActive(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" && filtered[active]) {
        e.preventDefault();
        go(filtered[active].href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, close, go]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of filtered) {
      const arr = map.get(i.group) ?? [];
      arr.push(i);
      map.set(i.group, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  let running = -1;

  return (
    <>
      <button
        type="button"
        className="cmdk-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        title={`Search (${mod}+K)`}
      >
        <span className="cmdk-trigger-label">Jump to…</span>
        <kbd className="kbd">{mod}K</kbd>
      </button>
      {open ? (
        <div className="cmdk-root">
          <button type="button" className="cmdk-backdrop" aria-label="Close" onClick={close} />
          <div
            className="cmdk-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Jump to a page"
          >
            <input
              ref={inputRef}
              className="cmdk-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pages and actions…"
              aria-label="Filter destinations"
            />
            <div className="cmdk-list" role="listbox">
              {filtered.length === 0 ? (
                <p className="cmdk-empty">Nothing matches. Try “applications” or “post”.</p>
              ) : (
                groups.map(([group, rows]) => (
                  <div key={group} className="cmdk-group">
                    <div className="cmdk-group-label">{group}</div>
                    {rows.map((item) => {
                      running += 1;
                      const idx = running;
                      return (
                        <button
                          key={item.href}
                          type="button"
                          role="option"
                          aria-selected={idx === active}
                          className={`cmdk-item${idx === active ? " is-active" : ""}`}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => go(item.href)}
                        >
                          <span>{item.label}</span>
                          <span className="cmdk-hint">{item.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
