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
import { dateLabel, timeAgo } from "@/lib/client/format";
import { initials } from "@/lib/client/nav";
import { slotSummary, teamStatusLabel } from "@/lib/client/team";
import { TeamInviteForm } from "@/components/team-invite-form";
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
      if (!ok) return;
      // In parallel: the calendar status is optional and independent of the team.
      const [, status] = await Promise.all([load(), apiGetCalendarStatus().catch(() => null)]);
      if (status) {
        setCalendarConnected(status.connected);
        setCalendarEnabled(status.enabled);
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

  if (ready && !signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  const user = getUser();
  const isLead = team?.lead.id === user?.id;
  const isMember = team?.members.some((m) => m.userId === user?.id) ?? false;
  const canRequest = user?.role === "STUDENT" && !isLead && !isMember && team?.status === "FORMING";
  const slots = team ? slotSummary(team) : { filled: 0, total: 0, open: 0 };

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
        <div className="wrap page-stack">
          <Link href="/teams" className="back-link">← Teams</Link>

          {error && <p className="form-err" role="alert">{error}</p>}
          {info && <p className="form-ok" role="status">{info}</p>}

          {!team ? (
            <div className="skeleton skeleton-card" aria-busy="true" />
          ) : (
            <>
              <section className="card team-hero">
                <div className="team-hero-main">
                  <span className={`status-pill team-${team.status.toLowerCase()}`}>{teamStatusLabel(team.status)}</span>
                  <h1>{team.name}</h1>
                  <p className="team-hero-meta">
                    {team.hackathon}
                    {team.eventDate && <> · {dateLabel(team.eventDate)}</>}
                    {" · "}Led by <Link href={`/profile/${team.lead.id}`}>{team.lead.name}</Link>
                  </p>
                  {team.description && <p className="team-hero-desc">{team.description}</p>}
                </div>
                <div className="team-hero-side">
                  <div className="team-card-slots">
                    <div className="meter" aria-hidden="true">
                      <span style={{ width: `${slots.total ? Math.round((slots.filled / slots.total) * 100) : 0}%` }} />
                    </div>
                    <span>{slots.filled} of {slots.total} spots filled</span>
                  </div>
                  {isLead && (
                    <div className="row-actions">
                      {team.status !== "CLOSED" && (
                        <Link className="btn btn-primary btn-sm" href={`/teams/${id}/edit`}>Edit team</Link>
                      )}
                      <Link className="btn btn-ghost btn-sm" href={`/teams/${id}/requests`}>Join requests</Link>
                      {team.status === "FORMING" && (
                        <button className="btn btn-text btn-sm" type="button" disabled={busy} onClick={() => void close()}>
                          Close team
                        </button>
                      )}
                    </div>
                  )}
                  {isLead && team.status === "FORMING" && (
                    <TeamInviteForm teamId={team.id} teamName={team.name} roles={team.roles} />
                  )}
                </div>
              </section>

              <div className="team-detail-grid">
                <section className="card section-card">
                  <header>
                    <h2>Roles</h2>
                    {canRequest && <p>Request the spot that fits you. The lead reviews every request.</p>}
                  </header>
                  <ul className="role-list">
                    {team.roles.map((r) => {
                      const free = r.slotCount - r.slotsFilled;
                      const name = (skillId: string) => r.skills.find((s) => s.id === skillId)?.name;
                      const canAsk =
                        canRequest && free > 0 &&
                        (!r.myRequest || r.myRequest.status === "REJECTED" || r.myRequest.status === "WITHDRAWN");
                      return (
                        <li key={r.id} className="role-item">
                          <div className="role-item-head">
                            <strong>{r.label}</strong>
                            <span className={`role-chip${free > 0 ? "" : " is-full"}`}>
                              {free > 0 ? `${free} of ${r.slotCount} open` : "Filled"}
                            </span>
                          </div>

                          {r.skills.length > 0 && (
                            <div className="chip-row">
                              {r.skills.map((s) => {
                                const have = r.skillFit?.matched.includes(s.id);
                                return (
                                  <span key={s.id} className={`skill-tag${have ? " is-match" : ""}`}>
                                    {have && <span aria-hidden="true">✓ </span>}
                                    {s.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {r.skillFit && r.skillFit.matched.length > 0 && r.skillFit.missing.length > 0 && (
                            <p className="field-hint">
                              You don&apos;t list {r.skillFit.missing.map(name).filter(Boolean).join(", ")} yet.
                            </p>
                          )}

                          {r.myRequest?.status === "PENDING" && (
                            <div className="row-actions">
                              <span className="status-pill is-pending">Request pending</span>
                              <button className="btn btn-text btn-sm" type="button"
                                disabled={withdrawingId === r.myRequest.id}
                                onClick={() => void withdrawRequest(r.myRequest!.id)}>
                                {withdrawingId === r.myRequest.id ? "Withdrawing…" : "Withdraw"}
                              </button>
                            </div>
                          )}
                          {r.myRequest?.status === "ACCEPTED" && (
                            <span className="status-pill is-ok">You&apos;re on this team</span>
                          )}

                          {canAsk && requestingRoleId !== r.id && (
                            <div>
                              <button className="btn btn-primary btn-sm" type="button" onClick={() => setRequestingRoleId(r.id)}>
                                {r.myRequest?.status === "REJECTED" ? "Request again" : "Request this spot"}
                              </button>
                            </div>
                          )}
                          {requestingRoleId === r.id && (
                            <div className="inset-form request-form">
                              <label htmlFor={`msg-${r.id}`}>Message to {team.lead.name} <span className="optional">optional</span></label>
                              <textarea id={`msg-${r.id}`} rows={2} value={message} disabled={busy} maxLength={500}
                                placeholder="What you'd bring to this role"
                                onChange={(e) => setMessage(e.target.value)} />
                              <div className="row-actions">
                                <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void submitRequest(r.id)}>
                                  {busy ? "Sending…" : "Send request"}
                                </button>
                                <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => setRequestingRoleId(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <div className="page-stack">
                  <section className="card section-card">
                    <header>
                      <h2>Members <span className="count">{team.members.length + 1}</span></h2>
                    </header>
                    <ul className="member-list">
                      <li>
                        <span className="avatar" aria-hidden="true">{initials(team.lead.name)}</span>
                        <span>
                          <Link href={`/profile/${team.lead.id}`}>{team.lead.name}</Link>
                          <span className="field-hint">Team lead</span>
                        </span>
                      </li>
                      {team.members.map((m) => (
                        <li key={m.userId}>
                          <span className="avatar" aria-hidden="true">{initials(m.name)}</span>
                          <span>
                            <Link href={`/profile/${m.userId}`}>{m.name}</Link>
                            <span className="field-hint">
                              {team.roles.find((r) => r.id === m.roleId)?.label ?? "Member"} · joined {timeAgo(m.joinedAt)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {calendarEnabled && (isLead || isMember) && team.status !== "CLOSED" && (
                    <section className="card section-card">
                      <header>
                        <h2>Meetings</h2>
                      </header>
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
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setScheduling(true)}>
                            Schedule a team meeting
                          </button>
                        )
                      )}
                    </section>
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
