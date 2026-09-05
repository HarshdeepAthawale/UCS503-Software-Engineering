"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type FormSelectOption = {
  value: string;
  label: string;
  hint?: string;
  group?: string;
};

type FormSelectProps = {
  id: string;
  value: string;
  options: FormSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show a search field when the list is long. Defaults to true above 8 options. */
  searchable?: boolean;
  disabled?: boolean;
  /** Single-line trigger for tight inline rows (skill picker, filter bars). */
  compact?: boolean;
};

export function FormSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchable,
  disabled = false,
  compact = false,
}: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length > 8;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        o.value.toLowerCase().includes(needle) ||
        o.hint?.toLowerCase().includes(needle) ||
        o.group?.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, FormSelectOption[]>();
    for (const o of filtered) {
      const key = o.group ?? "";
      const arr = map.get(key) ?? [];
      arr.push(o);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (showSearch) searchRef.current?.focus();
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, showSearch]);

  return (
    <div className={`form-select${compact ? " form-select--compact" : ""}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        className={`form-select-trigger${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className={`form-select-value${selected ? "" : " is-placeholder"}`}>
          {selected?.label ?? placeholder}
        </span>
        {selected?.hint && !compact ? <span className="form-select-hint">{selected.hint}</span> : null}
        <svg className="form-select-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="form-select-menu">
          {showSearch ? (
            <div className="form-select-search">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search branches…"
                aria-label="Search options"
              />
            </div>
          ) : null}
          <ul id={listId} className="form-select-list" role="listbox" aria-labelledby={id}>
            {filtered.length === 0 ? (
              <li className="form-select-empty">No matches.</li>
            ) : (
              grouped.map(([group, rows]) => (
                <li key={group || "__ungrouped"} role="presentation">
                  {group ? <div className="form-select-group-label">{group}</div> : null}
                  <ul className="form-select-group" role="group">
                    {rows.map((o) => {
                      const active = o.value === value;
                      return (
                        <li key={o.value || "__empty"} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`form-select-option${active ? " is-selected" : ""}`}
                            onClick={() => {
                              onChange(o.value);
                              setOpen(false);
                            }}
                          >
                            <span className="form-select-option-label">{o.label}</span>
                            {o.hint ? (
                              <span className="form-select-option-hint">{o.hint}</span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
