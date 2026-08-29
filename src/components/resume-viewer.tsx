"use client";

import { useEffect, useState } from "react";
import { apiGetResume, ApiError, type ResumeView } from "@/lib/client/api";

/**
 * Inline résumé preview (T-44, M2). Fetches the metadata + short-lived signed
 * URLs for `userId`, renders the PDF in the browser's native viewer, and offers
 * a download. Mounting it triggers the fetch, so callers can lazy-load it (e.g.
 * only when a reviewer expands an applicant card) to avoid minting URLs eagerly.
 * `refreshKey` forces a re-fetch (used after the owner re-uploads).
 */
export function ResumeViewer({ userId, refreshKey }: { userId: string; refreshKey?: number }) {
  const [status, setStatus] = useState<"loading" | "none" | "error" | "ready">("loading");
  const [resume, setResume] = useState<ResumeView | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    apiGetResume(userId)
      .then((r) => {
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
  }, [userId, refreshKey]);

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
}
