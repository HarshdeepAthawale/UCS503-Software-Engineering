"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { Conversation } from "@/components/conversation";
import { MeetingList } from "@/components/meeting-list";
import {
  apiCancelMeeting,
  apiListApplicationMeetings,
  apiListMessages,
  apiListMyApplications,
  apiWithdraw,
  ApiError,
  bootstrapSession,
  getUser,
  type Meeting,
  type MessageThreadContext,
  type MyApplication,
} from "@/lib/client/api";
import { progressSteps } from "@/lib/client/application-progress";
import { dateLabel, oppTypeLabel } from "@/lib/client/format";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";
import { appStateLabel } from "@/lib/domain/app-state-label";

/**
 * One application: the posting and the other party, where it stands, any
 * meetings, and the conversation (messaging lives inside an application).
 * The student also sees the step tracker and can withdraw.
 */
export default function ApplicationPage() {
  const id = useParams<{ id: string }>().id;
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [context, setContext] = useState<MessageThreadContext | null>(null);
  const [mine, setMine] = useState<MyApplication | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [cancelingMeetingId, setCancelingMeetingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      if (!ok) {
        setReady(true);
        return;
      }
      const student = getUser()?.role === "STUDENT";
      // In parallel; meetings and the student's own copy are optional.
      const [thread, meetingList, apps] = await Promise.all([
        apiListMessages(id).catch((err: unknown) => {
          if (!handleLoadError(router, err)) setError(loadErrorMessage(err, "Could not load this application."));
          return null;
        }),
        apiListApplicationMeetings(id).catch(() => [] as Meeting[]),
        student ? apiListMyApplications().catch(() => [] as MyApplication[]) : Promise.resolve([] as MyApplication[]),
      ]);
      if (thread) setContext(thread.context);
      setMeetings(meetingList);
      setMine(apps.find((a) => a.id === id) ?? null);
      setReady(true);
    })();
  }, [id, router]);

  async function onCancelMeeting(meetingId: string) {
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

  async function onWithdraw() {
    const prompt =
      mine?.status === "SELECTED"
        ? "Decline this offer? You were selected - withdrawing frees your seat for another applicant. This cannot be undone."
        : "Withdraw this application? It frees a slot in your application budget. This cannot be undone.";
    if (!confirm(prompt)) return;
    setBusy(true);
    try {
      await apiWithdraw(id);
      router.push("/applications");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not withdraw.");
    } finally {
      setBusy(false);
    }
  }

  if (ready && !signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card"><h1>Sign in required</h1>
          <div className="hero-actions"><Link className="btn btn-primary" href="/">Sign in</Link></div>
        </div>
      </main>
    );
  }

  const me = getUser();
  const isStudent = me?.role === "STUDENT";
  const other = context ? (isStudent ? context.poster : context.student) : null;
  // Matches canWithdraw() in application-state.ts: allowed from SELECTED too
  // (declining an offer), not from REJECTED/WITHDRAWN.
  const canWithdraw = isStudent && mine && !["REJECTED", "WITHDRAWN"].includes(mine.status);

  return (
    <div className="app-shell">
      <AppNav user={me} />
      <main id="content" className="app-page">
        <div className="wrap wrap-form page-stack">
          <Link href={isStudent ? "/applications" : "/messages"} className="back-link">
            ← {isStudent ? "Applications" : "Messages"}
          </Link>

          {error && <p className="form-err" role="alert">{error}</p>}

          {!ready || !context ? (
            !error && <div className="skeleton skeleton-card" aria-busy="true" />
          ) : (
            <>
              <section className="card app-hero">
                <div>
                  {mine && <span className="opp-card-type">{oppTypeLabel(mine.opportunity.type)}</span>}
                  <h1>
                    <Link href={`/opportunities/${context.opportunity.id}`}>{context.opportunity.title}</Link>
                  </h1>
                  <p className="app-card-meta">
                    {isStudent ? "Posted by" : "Applicant:"}{" "}
                    <Link href={`/profile/${other!.id}`}>{other!.name}</Link>
                    {mine && <> · applied {dateLabel(mine.appliedAt)}</>}
                  </p>
                </div>
                <span className={`stage-pill s-${context.status.toLowerCase()}`}>{appStateLabel(context.status)}</span>
              </section>

              {mine && (
                <section className="card section-card">
                  <ol className="progress" aria-label="Application progress">
                    {progressSteps(mine).map((s) => (
                      <li key={s.label} className={`progress-step is-${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>
                        <span className="progress-dot" aria-hidden="true">{s.state === "done" ? "✓" : ""}</span>
                        <span className="progress-label">{s.label}</span>
                        <span className="progress-date">
                          {s.at ? dateLabel(s.at) : s.state === "skipped" ? "Skipped" : s.state === "current" ? "Waiting" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {meetings.length > 0 && (
                <section className="card section-card">
                  <header><h2>Meetings</h2></header>
                  <MeetingList
                    meetings={meetings}
                    currentUserId={me?.id}
                    busyId={cancelingMeetingId}
                    onCancel={(meetingId) => void onCancelMeeting(meetingId)}
                  />
                </section>
              )}

              {me && (
                <div className="card conversation-card">
                  <Conversation applicationId={id} myId={me.id} />
                </div>
              )}

              {canWithdraw && (
                <div className="form-actions">
                  <button className="btn btn-text" type="button" onClick={() => void onWithdraw()} disabled={busy}>
                    {mine?.status === "SELECTED" ? "Decline offer" : "Withdraw application"}
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
