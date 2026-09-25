"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { AttestBar } from "@/components/attest-bar";
import { MeetingList } from "@/components/meeting-list";
import { MeetingScheduler } from "@/components/meeting-scheduler";
import { NavIcon } from "@/components/nav-icon";
import { RejectBar } from "@/components/reject-bar";
import { ResumeViewer } from "@/components/resume-viewer";
import { SignInRequired } from "@/components/sign-in-required";
import {
  apiCancelMeeting,
  apiGetCalendarStatus,
  apiGetOpportunity,
  apiIssueAttestation,
  apiListApplicants,
  apiListApplicationMeetings,
  apiScheduleApplicationMeeting,
  apiTransition,
  ApiError,
  bootstrapSession,
  getUser,
  googleCalendarConnectUrl,
  type Applicant,
  type Meeting,
  type RejectionCode,
} from "@/lib/client/api";
import {
  filterApplicants,
  MOVE_LABEL,
  nextSteps,
  rejectionLabel,
  SORT_OPTIONS,
  STAGE_TABS,
  stageCounts,
  type ApplicantSort,
  type PosterMove,
  type Stage,
} from "@/lib/client/applicants";
import { timeAgo } from "@/lib/client/format";
import { initials } from "@/lib/client/nav";
import { appStateLabel } from "@/lib/domain/app-state-label";

const PAGE_SIZE = 25;

/** Which panel is open under an applicant's row - one at a time. */
type Panel = "resume" | "reject" | "attest" | "meetings";

/**
 * The poster's review screen for one posting: stage tabs with counts, a
 * compact search/filter bar, and one row per applicant with the obvious next
 * move as the primary button. Narrow first, then work a page of 25 rows.
 */
export default function ApplicantsPage() {
  const id = useParams<{ id: string }>().id;
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; panel: Panel } | null>(null);
  const [rejectCode, setRejectCode] = useState<RejectionCode>("STRONGER_APPLICANTS");
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [meetingsByApp, setMeetingsByApp] = useState<Record<string, Meeting[]>>({});
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEnabled, setCalendarEnabled] = useState(false);

  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage>("ALL");
  const [minCgpa, setMinCgpa] = useState("");
  const [sort, setSort] = useState<ApplicantSort>("applied_desc");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setApplicants(await apiListApplicants(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applicants.");
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      if (ok) {
        await Promise.all([
          load(),
          apiGetOpportunity(id).then((o) => setTitle(o.title)).catch(() => {}),
          // Optional - a schedule attempt surfaces any calendar error.
          apiGetCalendarStatus()
            .then((s) => {
              setCalendarConnected(s.connected);
              setCalendarEnabled(s.enabled);
            })
            .catch(() => {}),
        ]);
      }
      setReady(true);
    })();
  }, [id, load]);

  // Feedback after the round trip to Google's consent screen. Read once, then
  // strip so a refresh doesn't repeat it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("calendarConnected")) {
      setInfo("Google Calendar connected.");
      setCalendarConnected(true);
    } else if (params.has("calendarError")) {
      setError(params.get("calendarError"));
    } else {
      return;
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Any filter/sort change invalidates the current page.
  useEffect(() => setPage(1), [q, stage, minCgpa, sort]);

  function toggle(appId: string, panel: Panel) {
    setOpen((cur) => (cur?.id === appId && cur.panel === panel ? null : { id: appId, panel }));
    if (panel === "reject") setRejectCode("STRONGER_APPLICANTS");
    if (panel === "meetings" && !meetingsByApp[appId]) {
      apiListApplicationMeetings(appId)
        .then((m) => setMeetingsByApp((prev) => ({ ...prev, [appId]: m })))
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load meetings."));
    }
  }

  async function move(app: Applicant, to: PosterMove, rejectionCode?: RejectionCode) {
    setError(null);
    setBusyId(app.id);
    try {
      await apiTransition(app.id, to, rejectionCode ? { rejectionCode } : {});
      setOpen(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the application.");
    } finally {
      setBusyId(null);
    }
  }

  async function attest(app: Applicant, skillId: string, context: string) {
    setError(null);
    setBusyId(app.id);
    try {
      await apiIssueAttestation(app.id, { skillId, context });
      setOpen(null);
      setInfo(`Skill attested for ${app.student.name}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not issue the attestation.");
    } finally {
      setBusyId(null);
    }
  }

  async function schedule(app: Applicant, input: { title: string; scheduledAt: string; durationMinutes: number }) {
    setError(null);
    setBusyId(app.id);
    try {
      const meeting = await apiScheduleApplicationMeeting(app.id, input);
      setMeetingsByApp((prev) => ({ ...prev, [app.id]: [meeting, ...(prev[app.id] ?? [])] }));
      setSchedulingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not schedule the meeting.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelMeeting(appId: string, meetingId: string) {
    setError(null);
    setBusyId(meetingId);
    try {
      await apiCancelMeeting(meetingId);
      setMeetingsByApp((prev) => ({
        ...prev,
        [appId]: (prev[appId] ?? []).map((m) => (m.id === meetingId ? { ...m, status: "CANCELLED" } : m)),
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel the meeting.");
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => stageCounts(applicants), [applicants]);
  const filtered = useMemo(
    () => filterApplicants(applicants, { stage, q, minCgpa, sort }),
    [applicants, stage, q, minCgpa, sort],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const narrowed = q.trim() !== "" || minCgpa.trim() !== "";

  if (ready && !signedIn) return <SignInRequired message="Sign in to review applicants." />;

  const me = getUser();

  return (
    <div className="app-shell">
      <AppNav user={me} />
      <main id="content" className="app-page">
        <div className="wrap page-stack">
          <div className="page-title-row">
            <div>
              <Link href={`/opportunities/${id}`} className="back-link">← Posting</Link>
              <h1>Applicants</h1>
              <p className="sub">
                {title ?? "…"}
                {ready && ` · ${applicants.length} applicant${applicants.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <Link href={`/opportunities/${id}/shortlisted`} className="btn btn-ghost">
              Shortlist board
            </Link>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}
          {info && <p className="form-ok" role="status">{info}</p>}

          {!ready ? (
            <div className="skeleton skeleton-card" aria-busy="true" />
          ) : applicants.length === 0 ? (
            <div className="empty-card">
              <h3>No applicants yet</h3>
              <p>Students who apply will appear here, newest first.</p>
            </div>
          ) : (
            <>
              <div className="stage-tabs" role="tablist" aria-label="Filter by stage">
                {STAGE_TABS.filter((t) => t.value === "ALL" || (counts.get(t.value) ?? 0) > 0 || stage === t.value).map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={stage === t.value}
                    className={`chip${stage === t.value ? " is-on" : ""}`}
                    onClick={() => setStage(t.value)}
                  >
                    {t.label}
                    <span className="stage-count">{counts.get(t.value) ?? 0}</span>
                  </button>
                ))}
              </div>

              <div className="applicant-toolbar">
                <div className="search-input">
                  <NavIcon name="search" size={16} />
                  <label htmlFor="applicant-search" className="sr-only">Search applicants by name</label>
                  <input id="applicant-search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by name" />
                </div>
                <label className="toolbar-field">
                  <span>Min CGPA</span>
                  <input type="number" inputMode="decimal" min={0} max={10} step={0.1} value={minCgpa}
                    onChange={(e) => setMinCgpa(e.target.value)} placeholder="Any" />
                </label>
                <label className="toolbar-field">
                  <span>Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as ApplicantSort)}>
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>

              {filtered.length === 0 ? (
                <div className="empty-card">
                  <h3>No applicants match</h3>
                  <p>{narrowed ? "Try a different name or a lower CGPA." : "Nobody is at this stage right now."}</p>
                  {(narrowed || stage !== "ALL") && (
                    <button type="button" className="btn btn-ghost" onClick={() => { setQ(""); setMinCgpa(""); setStage("ALL"); }}>
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <ul className="applicant-list">
                  {rows.map((a) => {
                    const steps = nextSteps(a.status);
                    const busy = busyId === a.id;
                    const panel = open?.id === a.id ? open.panel : null;
                    const canMeet = calendarEnabled && (a.status === "SHORTLISTED" || a.status === "INTERVIEW");
                    return (
                      <li key={a.id} className={`applicant${panel ? " is-open" : ""}`}>
                        <div className="applicant-row">
                          <span className="avatar" aria-hidden="true">{initials(a.student.name)}</span>
                          <div className="applicant-who">
                            <Link href={`/profile/${a.student.id}`} className="applicant-name">{a.student.name}</Link>
                            <span className="applicant-facts">
                              <span>{a.student.branch ?? "Branch not set"}</span>
                              <span>CGPA {a.student.cgpa ?? "–"}</span>
                              <span>{a.student.backlogs ?? 0} backlog{a.student.backlogs === 1 ? "" : "s"}</span>
                              <span>Applied {timeAgo(a.appliedAt)}</span>
                            </span>
                          </div>
                          <div className="applicant-stage">
                            <span className={`stage-pill s-${a.status.toLowerCase()}`}>{appStateLabel(a.status)}</span>
                            {a.rejectionCode && <span className="applicant-reason">{rejectionLabel(a.rejectionCode)}</span>}
                          </div>
                          <div className="applicant-actions">
                            {steps.primary && (
                              <button type="button" className="btn btn-primary btn-sm" disabled={busy}
                                onClick={() => void move(a, steps.primary!)}>
                                {MOVE_LABEL[steps.primary]}
                              </button>
                            )}
                            {steps.others.map((to) => (
                              <button key={to} type="button" className="btn btn-ghost btn-sm" disabled={busy}
                                onClick={() => void move(a, to)}>
                                {MOVE_LABEL[to]}
                              </button>
                            ))}
                            {a.status === "SELECTED" && (
                              <button type="button" className="btn btn-ghost btn-sm" aria-expanded={panel === "attest"}
                                onClick={() => toggle(a.id, "attest")}>
                                Attest a skill
                              </button>
                            )}
                            {steps.canReject && (
                              <button type="button" className="btn btn-text btn-sm applicant-reject" disabled={busy}
                                aria-expanded={panel === "reject"} onClick={() => toggle(a.id, "reject")}>
                                Not selected
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="applicant-tools">
                          <button type="button" className={panel === "resume" ? "is-on" : ""} aria-expanded={panel === "resume"}
                            onClick={() => toggle(a.id, "resume")}>
                            Résumé
                          </button>
                          {canMeet && (
                            <button type="button" className={panel === "meetings" ? "is-on" : ""} aria-expanded={panel === "meetings"}
                              onClick={() => toggle(a.id, "meetings")}>
                              Meetings
                            </button>
                          )}
                          <Link href={`/applications/${a.id}`}>Conversation &amp; history</Link>
                        </div>

                        {panel === "reject" && (
                          <div className="applicant-panel">
                            <RejectBar
                              value={rejectCode}
                              busy={busy}
                              onChange={setRejectCode}
                              onConfirm={() => void move(a, "REJECTED", rejectCode)}
                              onCancel={() => setOpen(null)}
                            />
                          </div>
                        )}
                        {panel === "attest" && (
                          <div className="applicant-panel">
                            <AttestBar
                              skills={a.student.skills}
                              busy={busy}
                              onConfirm={(skillId, context) => void attest(a, skillId, context)}
                              onCancel={() => setOpen(null)}
                            />
                          </div>
                        )}
                        {panel === "meetings" && (
                          <div className="applicant-panel">
                            <MeetingList
                              meetings={meetingsByApp[a.id] ?? []}
                              currentUserId={me?.id}
                              busyId={busyId}
                              onCancel={(meetingId) => void cancelMeeting(a.id, meetingId)}
                            />
                            {schedulingId === a.id ? (
                              <MeetingScheduler
                                busy={busy}
                                connected={calendarConnected}
                                connectUrl={googleCalendarConnectUrl(`/opportunities/${id}/applicants`)}
                                onConfirm={(input) => void schedule(a, input)}
                                onCancel={() => setSchedulingId(null)}
                              />
                            ) : (
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSchedulingId(a.id)}>
                                Schedule a meeting
                              </button>
                            )}
                          </div>
                        )}
                        {panel === "resume" && (
                          <div className="applicant-panel">
                            <ResumeViewer userId={a.student.id} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {totalPages > 1 && (
                <nav className="pager" aria-label="Pages">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                    ← Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next →
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
