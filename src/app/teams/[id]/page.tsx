"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiCloseTeam,
  apiGetTeam,
  apiRequestToJoinRole,
  apiWithdrawJoinRequest,
  apiGetCalendarStatus,
  apiListTeamMeetings,
  apiScheduleTeamMeeting,
  apiCancelMeeting,
  googleCalendarConnectUrl,
  ApiError,
  bootstrapSession,
  getUser,
  type Team,
  type Meeting,
} from "@/lib/client/api";
import { statusClass, timeAgo } from "@/lib/client/format";
import { MeetingScheduler } from "@/components/meeting-scheduler";
import { MeetingList } from "@/components/meeting-list";

export default function TeamDetailPage() {
  const id = useParams<{ id: string }>().id;
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [requestingRoleId, setRequestingRoleId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [cancelingMeetingId, setCancelingMeetingId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTeam(await apiGetTeam(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this team.");
      return;
    }
    try {
      // Restricted to the lead/members - a non-member viewer 403s here, which
      // must not blow away the team detail that already loaded successfully.
      setMeetings(await apiListTeamMeetings(id));
    } catch {
      setMeetings([]);
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
          /* optional */
        }
      }
    })();
  }, [load]);

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

  async function scheduleMeeting(input: { title: string; scheduledAt: string; durationMinutes: number }) {
    setError(null);
    setBusy(true);
    try {
      const meeting = await apiScheduleTeamMeeting(id, input);
      setMeetings((prev) => [meeting, ...prev]);
      setScheduling(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not schedule the meeting.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelMeeting(meetingId: string) {
    setError(null);
    setCancelingMeetingId(meetingId);
    try {
      await apiCancelMeeting(meetingId);
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, status: "CANCELLED" } : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel the meeting.");
    } finally {
      setCancelingMeetingId(null);
    }
  }

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/login">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  const user = getUser();
  const isLead = team?.lead.id === user?.id;
  const isMember = team?.members.some((m) => m.userId === user?.id) ?? false;
  const canRequest = user?.role === "STUDENT" && !isLead && !isMember && team?.status === "FORMING";

  async function submitRequest(roleId: string) {
    setError(null);
    setBusy(true);
    try {
      await apiRequestToJoinRole(id, roleId, message.trim() || undefined);
      setRequestingRoleId(null);
      setMessage("");
      setInfo("Request sent - the team lead will review it.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  async function withdrawRequest(requestId: string) {
    setError(null);
    setWithdrawingId(requestId);
    try {
      await apiWithdrawJoinRequest(id, requestId);
      setInfo("Request withdrawn.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not withdraw the request.");
    } finally {
      setWithdrawingId(null);
    }
  }

  async function close() {
    if (!confirm("Close this team? It stops accepting join requests immediately.")) return;
    setBusy(true);
    try {
      await apiCloseTeam(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close this team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main id="content" className="app-page">
        <div className="wrap">
          <Link href="/teams" className="back-link">← Back to teams</Link>

          {error && <p className="form-err" role="alert">{error}</p>}
          {info && <p className="empty-note" role="status">{info}</p>}

          {!team ? (
            <p className="app-loading">Loading team…</p>
          ) : (
            <>
              <div className="page-head">
                <div>
                  <span className={`pill ${statusClass(team.status)}`}>{team.status}</span>
                  <h1>{team.name}</h1>
                  <p className="sub">{team.hackathon}</p>
                  <p className="empty-note" style={{ marginTop: 6 }}>
                    Led by {team.lead.name}
                    {team.eventDate && <> · Event {new Date(team.eventDate).toLocaleDateString()}</>}
                  </p>
                </div>
                {isLead && (
                  <div className="row" style={{ gap: 8 }}>
                    <Link className="btn btn-ghost" href={`/teams/${id}/requests`}>Requests</Link>
                    {team.status === "FORMING" && (
                      <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void close()}>
                        Close team
                      </button>
                    )}
                  </div>
                )}
              </div>

              {team.description && (
                <div className="panel-card" style={{ marginBottom: 16 }}>
                  <p className="sub">{team.description}</p>
                </div>
              )}

              {calendarEnabled && (isLead || isMember) && team.status !== "CLOSED" && (
                <div className="panel-card" style={{ marginBottom: 16 }}>
                  <h2>Meetings</h2>
                  <MeetingList
                    meetings={meetings}
                    currentUserId={user?.id}
                    busyId={cancelingMeetingId}
                    onCancel={(meetingId) => void cancelMeeting(meetingId)}
                  />
                  {isLead && (
                    scheduling ? (
                      <MeetingScheduler
                        busy={busy}
                        connected={calendarConnected}
                        connectUrl={googleCalendarConnectUrl(`/teams/${id}`)}
                        onConfirm={(input) => void scheduleMeeting(input)}
                        onCancel={() => setScheduling(false)}
                      />
                    ) : (
                      <button className="mini solid" type="button" onClick={() => setScheduling(true)}>
                        Schedule team meeting
                      </button>
                    )
                  )}
                </div>
              )}

              <div className="panel-grid">
                <div className="panel-card">
                  <h2>Roles</h2>
                  {team.roles.map((r) => {
                    const open = r.slotsFilled < r.slotCount;
                    return (
                      <div key={r.id} className="proj-row">
                        <div className="proj-main">
                          <strong>{r.label}</strong>
                          <p className="sub">{r.slotsFilled} of {r.slotCount} filled</p>
                          {r.skills.length > 0 && (
                            <div className="skills-current" style={{ marginTop: 6 }}>
                              {r.skills.map((s) => (
                                <span
                                  key={s.id}
                                  className={`skill-chip${r.skillFit?.matched.includes(s.id) ? " skill-chip-verified" : ""}`}
                                >
                                  {r.skillFit?.matched.includes(s.id) && "✔ "}
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {r.skillFit && r.skillFit.matched.length > 0 && (
                            <p className="empty-note" style={{ marginTop: 6 }}>
                              You match on {r.skillFit.matched.map((id) => r.skills.find((s) => s.id === id)?.name).filter(Boolean).join(", ")}
                              {r.skillFit.missing.length > 0 &&
                                ` — missing: ${r.skillFit.missing.map((id) => r.skills.find((s) => s.id === id)?.name).filter(Boolean).join(", ")}`}
                            </p>
                          )}
                          {r.myRequest?.status === "PENDING" && (
                            <div className="row" style={{ marginTop: 8, gap: 8, alignItems: "center" }}>
                              <span className="pill p-shortlisted">Request pending</span>
                              <button
                                className="mini"
                                type="button"
                                disabled={withdrawingId === r.myRequest.id}
                                onClick={() => void withdrawRequest(r.myRequest!.id)}
                              >
                                {withdrawingId === r.myRequest.id ? "Withdrawing…" : "Withdraw"}
                              </button>
                            </div>
                          )}
                          {r.myRequest?.status === "ACCEPTED" && (
                            <p className="empty-note" style={{ marginTop: 8 }}>✔ You're on this team.</p>
                          )}
                          {canRequest &&
                            open &&
                            (!r.myRequest || r.myRequest.status === "REJECTED" || r.myRequest.status === "WITHDRAWN") &&
                            requestingRoleId !== r.id && (
                              <button className="mini solid" type="button" style={{ marginTop: 8 }} onClick={() => setRequestingRoleId(r.id)}>
                                {r.myRequest?.status === "REJECTED" ? "Request again" : "Request to join"}
                              </button>
                            )}
                          {requestingRoleId === r.id && (
                            <div className="reject-bar" style={{ marginTop: 8, flexWrap: "wrap" }}>
                              <input
                                aria-label="Message to the team lead"
                                placeholder="Why you'd be a good fit (optional)"
                                value={message}
                                disabled={busy}
                                onChange={(e) => setMessage(e.target.value)}
                                style={{ minWidth: 240 }}
                              />
                              <button className="mini solid" type="button" disabled={busy} onClick={() => void submitRequest(r.id)}>
                                {busy ? "Sending…" : "Send request"}
                              </button>
                              <button className="mini" type="button" disabled={busy} onClick={() => setRequestingRoleId(null)}>
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="panel-card">
                  <h2>Members</h2>
                  {team.members.length === 0 ? (
                    <p className="empty-note">No members yet.</p>
                  ) : (
                    <div className="proj-list">
                      {team.members.map((m) => (
                        <div key={m.userId} className="proj-row">
                          <div className="proj-main">
                            <Link href={`/profile/${m.userId}`}>{m.name}</Link>
                            <p className="empty-note">Joined {timeAgo(m.joinedAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
