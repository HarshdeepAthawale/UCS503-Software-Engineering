"use client";

import { HACKATHON_HINTS } from "@/lib/domain/hackathon";

type HackathonFilterProps = {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
};

/** Hackathon name filter with quick-pick chips for common events. */
export function HackathonFilter({ value, onChange, onSearch }: HackathonFilterProps) {
  return (
    <div className="hackathon-filter">
      <div className="field hackathon-filter-field">
        <label htmlFor="hackathon">Filter by hackathon</label>
        <input
          id="hackathon"
          list="hackathon-hints"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
          placeholder="e.g. Smart India Hackathon"
        />
        <datalist id="hackathon-hints">
          {HACKATHON_HINTS.map((h) => <option key={h} value={h} />)}
        </datalist>
      </div>
      <button className="btn btn-ghost" type="button" onClick={onSearch}>
        Search
      </button>
      <div className="hackathon-chips" role="group" aria-label="Popular hackathons">
        {HACKATHON_HINTS.slice(0, 4).map((h) => (
          <button
            key={h}
            type="button"
            className={`hackathon-chip${value === h ? " is-on" : ""}`}
            onClick={() => {
              onChange(h);
              onSearch();
            }}
          >
            {h.replace(/ 20\d{2}$/, "")}
          </button>
        ))}
      </div>
    </div>
  );
}
