"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ResumeViewer } from "@/components/resume-viewer";
import {
  apiListApplicants,
  apiTransition,
  apiIssueAttestation,
  apiGetCalendarStatus,
  apiListApplicationMeetings,
  apiScheduleApplicationMeeting,
  apiCancelMeeting,
  googleCalendarConnectUrl,
  ApiError,
  bootstrapSession,
  getUser,
  type Applicant,
  type AppState,
  type RejectionCode,
  type Meeting,
} from "@/lib/client/api";
import { RejectBar } from "@/components/reject-bar";
import { AttestBar } from "@/components/attest-bar";
import { MeetingScheduler } from "@/components/meeting-scheduler";
import { MeetingList } from "@/components/meeting-list";
import { statusClass, timeAgo, titleCase } from "@/lib/client/format";

// Which forward moves a poster may make from each state (mirrors the server -
// see POSTER_TRANSITIONS in src/lib/domain/application-state.ts). New
// applications skip RECEIVED entirely (APPLIED goes straight to
// SHORTLISTED/REJECTED), but it stays a valid FROM-state here too: any
// pre-existing RECEIVED row from before that change must still be movable,
// or the poster is stuck with an applicant they can never act on.
const NEXT: Record<string, Exclude<AppState, "APPLIED" | "WITHDRAWN" | "RECEIVED">[]> = {
  APPLIED: ["SHORTLISTED", "REJECTED"],
  RECEIVED: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "SELECTED", "REJECTED"],
  INTERVIEW: ["SELECTED", "REJECTED"],
};
const STATUS_TABS: { value: AppState | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "APPLIED", label: "Applied" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "SELECTED", label: "Selected" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];
const ACTION_LABEL: Record<string, string> = {
  SHORTLISTED: "Shortlist",
  INTERVIEW: "Interview",
  SELECTED: "Select",
  REJECTED: "Reject",
};

type SortKey = "applied_desc" | "applied_asc" | "cgpa_desc" | "name_asc";
const PAGE_SIZE = 25;

export default function ApplicantsPage() {
  const router = useRouter();
  const id = useParams<{ id: string }>().id;
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openResume, setOpenResume] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectCode, setRejectCode] = useState<RejectionCode>("STRONGER_APPLICANTS");
  const [attestingId, setAttestingId] = useState<string | null>(null);
  const [openMeetings, setOpenMeetings] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [meetingsByApp, setMeetingsByApp] = useState<Record<string, Meeting[]>>({});
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppState | "ALL">("ALL");
  const [minCgpaFilter, setMinCgpaFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("applied_desc");
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
      setReady(true);
      if (ok) {
        await load();
        try {
          const status = await apiGetCalendarStatus();
          setCalendarConnected(status.connected);
          setCalendarEnabled(status.enabled);
        } catch {
          /* calendar status is optional - schedule attempt surfaces the error */
        }
      }
    })();
  }, [load]);

  // Feedback after the round trip to Google's consent screen (calendar/start ->
  // callback -> back here). Read once, then strip so a refresh doesn't repeat it.
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
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, minCgpaFilter, sort]);

  async function move(app: Applicant, to: Exclude<AppState, "APPLIED" | "WITHDRAWN" | "RECEIVED">) {
    if (to === "REJECTED") {
      setRejectingId(app.id);
      setRejectCode("STRONGER_APPLICANTS");
      return;
    }
    await applyTransition(app, to);
  }

  async function applyTransition(
    app: Applicant,
    to: Exclude<AppState, "APPLIED" | "WITHDRAWN" | "RECEIVED">,
    rejectionCode?: RejectionCode,
  ) {
    setError(null);
    setBusyId(app.id);
    try {
      await apiTransition(app.id, to, rejectionCode ? { rejectionCode } : {});
      setRejectingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the application.");
    } finally {
      setBusyId(null);
    }
  }

  async function issueAttestation(app: Applicant, skillId: string, context: string) {
    setError(null);
    setBusyId(app.id);
    try {
      await apiIssueAttestation(app.id, { skillId, context });
      setAttestingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not issue the attestation.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleMeetings(appId: string) {
    if (openMeetings === appId) {
      setOpenMeetings(null);
      return;
    }
    setOpenMeetings(appId);
    if (!meetingsByApp[appId]) {
      try {
        const meetings = await apiListApplicationMeetings(appId);
        setMeetingsByApp((prev) => ({ ...prev, [appId]: meetings }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load meetings.");
      }
    }
  }

  async function scheduleMeeting(
    app: Applicant,
    input: { title: string; scheduledAt: string; durationMinutes: number },
  ) {
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

  const filtered = useMemo(() => {
    const cgpaFloor = minCgpaFilter === "" ? null : Number(minCgpaFilter);
    const q = search.trim().toLowerCase();
    let list = applicants;
    if (statusFilter !== "ALL") list = list.filter((a) => a.status === statusFilter);
    if (cgpaFloor != null) list = list.filter((a) => a.student.cgpa != null && a.student.cgpa >= cgpaFloor);
    if (q) list = list.filter((a) => a.student.name.toLowerCase().includes(q));

    const sorted = [...list];
    switch (sort) {
      case "applied_asc":
        sorted.sort((a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime());
        break;
      case "cgpa_desc":
        sorted.sort((a, b) => (b.student.cgpa ?? -1) - (a.student.cgpa ?? -1));
        break;
      case "name_asc":
        sorted.sort((a, b) => a.student.name.localeCompare(b.student.name));
        break;
      case "applied_desc":
      default:
        sorted.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    }
    return sorted;
  }, [applicants, statusFilter, minCgpaFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const countByStatus = useMemo(() => {
    const m = new Map<AppState, number>();
    for (const a of applicants) m.set(a.status, (m.get(a.status) ?? 0) + 1);
    return m;
  }, [applicants]);

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card"><h1>Sign in required</h1>
          <div className="hero-actions"><Link className="btn btn-primary" href="/">Sign in</Link></div>
        </div>
      </main>
    );
  }

  function goToProfile(studentId: string) {
    router.push(`/profile/${studentId}`);
  }

  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap">
          <Link href={`/opportunities/${id}`} className="back-link">
            ← Back to posting
          </Link>
          <div className="page-head">
            <div>
              <h1>Applicant pipeline</h1>
              <p className="sub">
                {filtered.length} of {applicants.length} applicant{applicants.length === 1 ? "" : "s"} shown · click a row for the full profile.
              </p>
              <Link href={`/opportunities/${id}/shortlisted`} className="link-quiet">
                Shortlisted candidates →
              </Link>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}
          {info && <p className="empty-note" role="status">{info}</p>}

          {applicants.length === 0 ? (
            <div className="app-empty"><h3>No applicants yet</h3><p>They'll appear here as students apply.</p></div>
          ) : (
            <>
              {/* Search + filters — this is how a 100+ applicant pipeline stays
                  usable: narrow first, then scan a page of 25 rows at a time,
                  rather than scrolling a wall of cards. */}
              <div className="panel filter-bar">
                <div className="field" style={{ minWidth: 200 }}>
                  <label htmlFor="search">Search by name</label>
                  <input id="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Priya" />
                </div>
                <div className="field" style={{ minWidth: 160 }}>
                  <label htmlFor="cgpaFilter">Minimum CGPA</label>
                  <input
                    id="cgpaFilter"
                    type="number"
                    min={0}
                    max={10}
                    step={0.01}
                    value={minCgpaFilter}
                    onChange={(e) => setMinCgpaFilter(e.target.value)}
                    placeholder="e.g. 7.5"
                  />
                </div>
                <div className="field" style={{ minWidth: 180 }}>
                  <label htmlFor="sort">Sort by</label>
                  <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    <option value="applied_desc">Applied — newest first</option>
                    <option value="applied_asc">Applied — oldest first</option>
                    <option value="cgpa_desc">CGPA — highest first</option>
                    <option value="name_asc">Name — A to Z</option>
                  </select>
                </div>
                <div className="field" style={{ minWidth: 180 }}>
                  <label htmlFor="statusFilter">Status</label>
                  <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AppState | "ALL")}>
                    {STATUS_TABS.map((tab) => (
                      <option key={tab.value} value={tab.value}>
                        {tab.label} ({tab.value === "ALL" ? applicants.length : countByStatus.get(tab.value) ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="app-empty"><h3>No applicants match</h3><p>Try clearing a filter.</p></div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="atable">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Branch</th>
                        <th>CGPA</th>
                        <th>Backlogs</th>
                        <th>Applied</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((a) => (
                        <Fragment key={a.id}>
                          <tr
                            onClick={() => goToProfile(a.student.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <td>
                              {/* A real <Link> too, not just row-click: keeps
                                  middle-click / open-in-new-tab working. */}
                              <Link href={`/profile/${a.student.id}`} onClick={(e) => e.stopPropagation()}>
                                {a.student.name}
                              </Link>
                            </td>
                            <td>{a.student.branch ?? "—"}</td>
                            <td>{a.student.cgpa ?? "—"}</td>
                            <td>{a.student.backlogs ?? "—"}</td>
                            <td>{timeAgo(a.appliedAt)}</td>
                            <td>
                              <span className={`pill ${statusClass(a.status)}`}>{titleCase(a.status)}</span>
                              {a.rejectionCode && (
                                <div className="tl-meta" style={{ marginTop: 4 }}>{titleCase(a.rejectionCode)}</div>
                              )}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                                {NEXT[a.status]?.map((to) => (
                                  <button
                                    key={to}
                                    type="button"
                                    className={`mini${to === "REJECTED" ? "" : " solid"}`}
                                    disabled={busyId === a.id}
                                    onClick={() => void move(a, to)}
                                  >
                                    {ACTION_LABEL[to]}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  className="mini"
                                  onClick={() => setOpenResume((cur) => (cur === a.id ? null : a.id))}
                                >
                                  {openResume === a.id ? "Hide résumé" : "Résumé"}
                                </button>
                                {a.status === "SELECTED" && (
                                  <button
                                    type="button"
                                    className="mini solid"
                                    onClick={() => setAttestingId((cur) => (cur === a.id ? null : a.id))}
                                  >
                                    Attest a skill
                                  </button>
                                )}
                                {calendarEnabled && (a.status === "SHORTLISTED" || a.status === "INTERVIEW") && (
                                  <button type="button" className="mini" onClick={() => void toggleMeetings(a.id)}>
                                    {openMeetings === a.id ? "Hide meetings" : "Meetings"}
                                  </button>
                                )}
                                <Link className="link-quiet" href={`/applications/${a.id}`}>
                                  Timeline →
                                </Link>
                              </div>
                              {rejectingId === a.id && (
                                <RejectBar
                                  value={rejectCode}
                                  busy={busyId === a.id}
                                  onChange={setRejectCode}
                                  onConfirm={() => void applyTransition(a, "REJECTED", rejectCode)}
                                  onCancel={() => setRejectingId(null)}
                                />
                              )}
                              {attestingId === a.id && (
                                <AttestBar
                                  skills={a.student.skills}
                                  busy={busyId === a.id}
                                  onConfirm={(skillId, context) => void issueAttestation(a, skillId, context)}
                                  onCancel={() => setAttestingId(null)}
                                />
                              )}
                              {openMeetings === a.id && (
                                <div style={{ marginTop: 8 }}>
                                  <MeetingList
                                    meetings={meetingsByApp[a.id] ?? []}
                                    currentUserId={getUser()?.id}
                                    busyId={busyId}
                                    onCancel={(meetingId) => void cancelMeeting(a.id, meetingId)}
                                  />
                                  {schedulingId === a.id ? (
                                    <MeetingScheduler
                                      busy={busyId === a.id}
                                      connected={calendarConnected}
                                      connectUrl={googleCalendarConnectUrl(`/opportunities/${id}/applicants`)}
                                      onConfirm={(input) => void scheduleMeeting(a, input)}
                                      onCancel={() => setSchedulingId(null)}
                                    />
                                  ) : (
                                    <button type="button" className="mini solid" onClick={() => setSchedulingId(a.id)}>
                                      Schedule Meet
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                          {openResume === a.id && (
                            <tr onClick={(e) => e.stopPropagation()}>
                              <td colSpan={7} className="resume-expand">
                                <ResumeViewer userId={a.student.id} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="row" style={{ justifyContent: "center", gap: 12, marginTop: 16 }}>
                  <button type="button" className="mini" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                    ← Prev
                  </button>
                  <span className="tl-meta">Page {currentPage} of {totalPages}</span>
                  <button type="button" className="mini" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
