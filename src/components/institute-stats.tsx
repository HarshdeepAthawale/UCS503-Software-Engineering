"use client";

import { useEffect, useState } from "react";

type PublicStats = {
  livePostings: number;
  atRiskPostings: number;
  totalApplications: number;
  resolvedApplications: number;
  resolutionRate: number;
  medianTtaHours: number | null;
  activeUsers: number;
  asOf: string;
};

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Live metrics from the database — no mock or demo values. */
export function InstituteStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/public/stats", { cache: "no-store" });
        if (!res.ok) throw new Error("unavailable");
        setStats((await res.json()) as PublicStats);
      } catch {
        setError("Metrics are temporarily unavailable.");
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="stats-monitor panel">
        <p className="stats-monitor-err">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="stats-monitor panel" aria-busy="true">
        <p className="stats-monitor-loading">Loading live metrics…</p>
      </div>
    );
  }

  const updated = new Date(stats.asOf).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows = [
    { label: "Live postings", value: String(stats.livePostings) },
    { label: "At-risk postings", value: String(stats.atRiskPostings) },
    { label: "Applications", value: String(stats.totalApplications) },
    { label: "Resolved", value: String(stats.resolvedApplications) },
    { label: "Resolution rate", value: pct(stats.resolutionRate) },
    {
      label: "Median TTA",
      value: stats.medianTtaHours == null ? "—" : `${stats.medianTtaHours}h`,
    },
    { label: "Active accounts", value: String(stats.activeUsers) },
  ];

  const empty =
    stats.livePostings === 0 &&
    stats.totalApplications === 0 &&
    stats.activeUsers === 0;

  return (
    <div className="stats-monitor panel">
      <div className="stats-monitor-head">
        <span className="stats-monitor-title">Live platform metrics</span>
        <time className="stats-monitor-time mono" dateTime={stats.asOf}>
          {updated}
        </time>
      </div>
      {empty ? (
        <p className="stats-monitor-empty">
          No activity recorded yet. Figures appear here as soon as accounts register,
          postings go live, and applications move through the pipeline.
        </p>
      ) : null}
      <dl className="stats-monitor-grid">
        {rows.map((row) => (
          <div key={row.label} className="stats-monitor-row">
            <dt>{row.label}</dt>
            <dd className="mono">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
