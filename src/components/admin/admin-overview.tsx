"use client";

import { useEffect, useState } from "react";
import { apiAdminAnalytics, type AdminOverview, type AppState, type InstituteAnalytics } from "@/lib/client/api";
import { attentionItems, type AdminTab } from "@/lib/client/admin";
import { titleCase } from "@/lib/client/format";
import { appStateLabel } from "@/lib/domain/app-state-label";

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function Kpi({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

function Breakdown({ title, data, labelOf = titleCase }: { title: string; data: Record<string, number>; labelOf?: (k: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <section className="card section-card">
      <header><h2>{title}</h2></header>
      {entries.length === 0 ? (
        <p className="muted-note">Nothing yet.</p>
      ) : (
        <div className="bar-list">
          {entries.map(([k, v]) => (
            <div key={k} className="bar-row">
              <span className="bar-label">{labelOf(k)}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.round((v / max) * 100)}%` }} /></span>
              <span className="bar-val">{v}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** What needs attention, who is on the platform, and how the pipeline is doing. */
export function AdminOverviewPanel({
  overview,
  onGo,
  onError,
}: {
  overview: AdminOverview | null;
  onGo: (tab: AdminTab) => void;
  onError: (msg: string) => void;
}) {
  const [analytics, setAnalytics] = useState<InstituteAnalytics | null>(null);

  useEffect(() => {
    apiAdminAnalytics().then(setAnalytics).catch(() => onError("Could not load analytics."));
  }, [onError]);

  if (!overview) return <div className="skeleton skeleton-card" aria-busy="true" />;

  const attention = attentionItems(overview);
  const members = (overview.users.STUDENT ?? 0) + (overview.users.FACULTY ?? 0) + (overview.users.ALUMNI ?? 0);
  const last14 = analytics?.perDay.reduce((s, d) => s + d.count, 0) ?? 0;
  const sparkMax = Math.max(1, ...(analytics?.perDay.map((d) => d.count) ?? [0]));

  return (
    <div className="page-stack">
      <section className={`card attention${attention.length === 0 ? " is-clear" : ""}`}>
        <h2>{attention.length === 0 ? "Nothing needs you right now" : "Needs attention"}</h2>
        {attention.length === 0 ? (
          <p>No open flags, no postings going silent, no claims waiting.</p>
        ) : (
          <ul>
            {attention.map((a) => (
              <li key={a.key}>
                <span className="attention-count">{a.count}</span>
                <span className="attention-label">{a.label}</span>
                {a.tab && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onGo(a.tab!)}>Review</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div>
        <h2 className="kpi-heading">People</h2>
        <div className="kpi-grid">
          <Kpi value={members} label="Members" />
          <Kpi value={overview.users.STUDENT ?? 0} label="Students" />
          <Kpi value={overview.users.FACULTY ?? 0} label="Faculty" />
          <Kpi value={overview.users.ALUMNI ?? 0} label="Alumni" />
        </div>
      </div>

      <div>
        <h2 className="kpi-heading">Postings &amp; applications</h2>
        <div className="kpi-grid">
          <Kpi value={overview.opportunities.live} label="Live postings" />
          <Kpi value={overview.applications} label="Applications" />
          <Kpi value={analytics ? pct(analytics.applications.resolutionRate) : "…"} label="Reached a decision" />
          <Kpi
            value={analytics?.applications.medianTtaHours == null ? "–" : `${analytics.applications.medianTtaHours}h`}
            label="Median first response"
          />
          <Kpi value={analytics ? `${analytics.seats.filled}/${analytics.seats.total}` : "…"} label="Seats filled"
            hint={analytics ? pct(analytics.seats.fillRate) : undefined} />
        </div>
      </div>

      {analytics && (
        <>
          <section className="card section-card">
            <header>
              <h2>Applications, last 14 days</h2>
              <p>{last14} in this window</p>
            </header>
            <div className="spark" role="img" aria-label={`Applications per day over the last 14 days: ${last14} in total`}>
              {analytics.perDay.map((d) => (
                <span key={d.day} className="spark-col" title={`${d.day}: ${d.count}`}>
                  <span className="spark-bar" style={{ height: `${Math.round((d.count / sparkMax) * 100)}%` }} />
                </span>
              ))}
            </div>
          </section>

          <div className="breakdown-grid">
            <Breakdown title="Applications by stage" data={analytics.byAppState} labelOf={(k) => appStateLabel(k as AppState)} />
            <Breakdown title="Postings by type" data={analytics.byOppType} />
            <Breakdown title="Postings by status" data={analytics.byOppStatus} />
          </div>

          <p className="muted-note">
            Figures come from the application event log, so response times and decisions cannot be back-dated or self-reported.
          </p>
        </>
      )}
    </div>
  );
}
