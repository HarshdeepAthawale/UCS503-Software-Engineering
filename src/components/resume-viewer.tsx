"use client";

import { memo, useEffect, useState } from "react";
import { apiGetResume, ApiError, type ResumeView } from "@/lib/client/api";

/**
 * Short-lived cache of already-fetched résumé views.
 *
 * Callers mount and unmount this component to show/hide a preview (the applicant
 * pipeline toggles it per card), and every mount used to re-mint two signed URLs
 * and re-download the PDF into a fresh iframe — so reopening the same résumé
 * paid the full cost again. Entries expire before the signed URLs do (the server
 * signs for 300s), so a cached URL is never handed out dead.
 */
const SIGNED_URL_TTL_MS = 300_000;
const CACHE_TTL_MS = SIGNED_URL_TTL_MS - 60_000;
const cache = new Map<string, { at: number; value: ResumeView | null }>();

function cached(key: string): { value: ResumeView | null } | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

/**
 * Inline résumé preview (T-44, M2). Fetches the metadata + short-lived signed
 * URLs for `userId`, renders the PDF in the browser's native viewer, and offers
 * a download. Mounting it triggers the fetch, so callers can lazy-load it (e.g.
 * only when a reviewer expands an applicant card) to avoid minting URLs eagerly.
 * `refreshKey` forces a re-fetch (used after the owner re-uploads) — it is part
 * of the cache key, so bumping it bypasses the cache rather than invalidating it.
 *
 * Memoised: on the profile editor this sits beside a dozen controlled inputs and
 * would otherwise re-render, with its PDF iframe, on every keystroke.
 */
export const ResumeViewer = memo(function ResumeViewer({
  userId,
  refreshKey,
}: {
  userId: string;
  refreshKey?: number;
}) {
  const key = `${userId}:${refreshKey ?? 0}`;
  const initial = cached(key);

  const [status, setStatus] = useState<"loading" | "none" | "error" | "ready">(() =>
    initial ? (initial.value ? "ready" : "none") : "loading",
  );
  const [resume, setResume] = useState<ResumeView | null>(initial?.value ?? null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Served from cache: no request, no loading flash. State is still written
    // here, not just in the initialiser, so switching `key` on a mounted
    // viewer (a different applicant, or a bumped refreshKey) shows the new
    // résumé instead of the previous one.
    const hit = cached(key);
    if (hit) {
      setResume(hit.value);
      setStatus(hit.value ? "ready" : "none");
      return;
    }

    let alive = true;
    setStatus("loading");
    apiGetResume(userId)
      .then((r) => {
        cache.set(key, { at: Date.now(), value: r });
        if (!alive) return;
        if (!r) {
          setStatus("none");
        } else {
          setResume(r);
          setStatus("ready");
        }
      })
      .catch((err) => {
        if (!alive) return;
        setMessage(err instanceof ApiError ? err.message : "Could not load the résumé.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [userId, key]);

  if (status === "loading") return <p className="empty-note">Loading résumé…</p>;
  if (status === "none") return <p className="empty-note">No résumé uploaded.</p>;
  if (status === "error") return <p className="form-err">{message}</p>;

  const r = resume!;
  const kb = r.size != null ? `${Math.max(1, Math.round(r.size / 1024))} KB` : null;

  return (
    <div className="resume-view">
      <div className="resume-bar">
        <span className="resume-name">{r.name ?? "resume.pdf"}</span>
        {kb && <span className="empty-note">{kb}</span>}
        <a
          className="mini solid"
          href={r.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Download
        </a>
      </div>
      <iframe className="resume-frame" src={r.previewUrl} title="Résumé preview" />
    </div>
  );
});
