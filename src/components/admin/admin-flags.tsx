"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { apiAdminListFlags, apiAdminResolveFlag, ApiError, type AdminFlag } from "@/lib/client/api";
import { timeAgo, titleCase } from "@/lib/client/format";

/** Reported postings, oldest decision first. Removing a posting is the super admin's call. */
export function AdminFlagsPanel({
  isSuper,
  onChanged,
  onNotice,
  onError,
}: {
  isSuper: boolean;
  onChanged: () => void;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [flags, setFlags] = useState<AdminFlag[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setFlags(await apiAdminListFlags());
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not load the flag queue.");
    }
  }, [onError]);

  useEffect(() => void load(), [load]);

  async function resolve(f: AdminFlag, decision: "RESOLVED" | "DISMISSED", removePosting = false) {
    setBusyId(f.id);
    try {
      await apiAdminResolveFlag(f.id, { decision, removePosting });
      await load();
      onChanged();
      onNotice(removePosting ? "Flag upheld and the posting removed." : decision === "RESOLVED" ? "Flag upheld." : "Flag dismissed.");
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not update the flag.");
    } finally {
      setBusyId(null);
    }
  }

  if (!flags) return <div className="skeleton skeleton-card" aria-busy="true" />;
  if (flags.length === 0) {
    return (
      <div className="empty-card">
        <h3>The queue is clear</h3>
        <p>When someone reports a posting, it lands here for review.</p>
      </div>
    );
  }

  return (
    <ul className="adm-list">
      {flags.map((f) => (
        <li key={f.id} className="adm-row flag-row">
          <div className="adm-row-main">
            <div className="flag-top">
              <span className="flag-reason">{titleCase(f.reason)}</span>
              <Link href={`/opportunities/${f.opportunity.id}`} className="adm-row-title">{f.opportunity.title}</Link>
            </div>
            {f.detail && <blockquote className="flag-detail">{f.detail}</blockquote>}
            <span className="adm-row-meta">
              Posted by {f.opportunity.poster.name} · reported by {f.reporter.name} {timeAgo(f.createdAt)}
            </span>
          </div>
          <div className="adm-row-actions">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === f.id}
              onClick={() => void resolve(f, "DISMISSED")}>
              Dismiss
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busyId === f.id}
              onClick={() => void resolve(f, "RESOLVED")}>
              Uphold
            </button>
            {isSuper && (
              <ConfirmAction
                danger
                label="Remove posting"
                question="Hide it from every listing?"
                confirmLabel="Remove"
                busy={busyId === f.id}
                onConfirm={() => void resolve(f, "RESOLVED", true)}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
