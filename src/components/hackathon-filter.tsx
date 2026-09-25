"use client";

import type { TeamSuggestions } from "@/lib/client/api";
import { NavIcon } from "@/components/nav-icon";

type HackathonFilterProps = {
  value: string;
  suggestions: TeamSuggestions["hackathons"];
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
};

/**
 * Search teams by hackathon. The quick-pick chips are the hackathons that have
 * a team recruiting right now (from /api/teams/suggestions), with how many -
 * never a hardcoded list of event names.
 */
export function HackathonFilter({ value, suggestions, onChange, onSearch }: HackathonFilterProps) {
  const pick = (name: string) => {
    const next = value === name ? "" : name;
    onChange(next);
    onSearch(next);
  };

  return (
    <div className="team-filter">
      <form
        className="search-input"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(value);
        }}
      >
        <NavIcon name="search" size={18} />
        <label htmlFor="hackathon" className="sr-only">Search teams by hackathon</label>
        <input
          id="hackathon"
          type="search"
          list="hackathon-suggestions"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value === "") onSearch("");
          }}
          placeholder="Search by hackathon"
        />
        <datalist id="hackathon-suggestions">
          {suggestions.map((h) => <option key={h.name} value={h.name} />)}
        </datalist>
        <button className="btn btn-primary btn-sm" type="submit">Search</button>
      </form>
      {suggestions.length > 0 && (
        <div className="chip-row" role="group" aria-label="Hackathons with teams recruiting">
          {suggestions.map((h) => (
            <button
              key={h.name}
              type="button"
              className={`chip${value === h.name ? " is-on" : ""}`}
              aria-pressed={value === h.name}
              onClick={() => pick(h.name)}
            >
              {h.name}
              <span className="chip-meta">{h.teams}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
