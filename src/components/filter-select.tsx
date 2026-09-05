"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type FilterSelectOption = { value: string; label: string; hint?: string };

const CHEVRON = (
  <svg className="facet-select-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** Spacer chevron — same grid cell as FilterSelect so text facets share height/width. */
const CHEVRON_SPACER = (
  <svg
    className="facet-select-chevron facet-select-chevron--spacer"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden
  >
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

type FacetTriggerShellProps = {
  label: string;
  labelId?: string;
  className?: string;
  children: ReactNode;
  chevron?: "menu" | "spacer";
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
};

/**
 * Shared trigger chrome for every facet control. FilterSelect and FacetTextInput
 * must both render through this so markup and grid placement never drift apart.
 */
function FacetTriggerShell({
  label,
  labelId,
  className = "",
  children,
  chevron = "menu",
  buttonProps,
}: FacetTriggerShellProps) {
  const generatedId = useId();
  const kickerId = labelId ?? generatedId;
  const triggerClass = `facet-select-trigger${className ? ` ${className}` : ""}`;
  const chevronNode = chevron === "menu" ? CHEVRON : CHEVRON_SPACER;

  if (buttonProps) {
    return (
      <button type="button" className={triggerClass} aria-labelledby={kickerId} {...buttonProps}>
        <span className="facet-select-kicker" id={kickerId}>{label}</span>
        <span className="facet-select-value">{children}</span>
        {chevronNode}
      </button>
    );
  }

  return (
    <div className={triggerClass} role="group" aria-labelledby={kickerId}>
      <span className="facet-select-kicker" id={kickerId}>{label}</span>
      <span className="facet-select-value">{children}</span>
      {chevronNode}
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
};

/** Accessible custom select for filter bars — avoids native option styling bugs in dark mode. */
export function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  return (
    <div className="facet-select" ref={rootRef}>
      <FacetTriggerShell
        label={label}
        className={open ? "is-open" : ""}
        buttonProps={{
          "aria-haspopup": "listbox",
          "aria-expanded": open,
          "aria-controls": listId,
          onClick: () => setOpen((v) => !v),
        }}
      >
        {selected?.label}
      </FacetTriggerShell>
      {open ? (
        <ul id={listId} className="facet-select-menu" role="listbox" aria-label={label}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value || "__all"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`facet-select-option${active ? " is-selected" : ""}`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="facet-select-option-label">{o.label}</span>
                  {o.hint ? <span className="facet-select-option-hint">{o.hint}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

type FacetTextInputProps = {
  label: string;
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

/** Text facet — same trigger shell and value row as FilterSelect. */
export function FacetTextInput({ label, id, value, placeholder, onChange }: FacetTextInputProps) {
  return (
    <div className="facet-select">
      <label className="facet-select-trigger facet-text-trigger" htmlFor={id}>
        <span className="facet-select-kicker">{label}</span>
        <span className="facet-select-value">
          <input
            id={id}
            className="facet-select-text"
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
        {CHEVRON_SPACER}
      </label>
    </div>
  );
}
