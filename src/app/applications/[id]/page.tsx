"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiListMessages,
  apiListMyApplications,
  apiSendMessage,
  apiWithdraw,
  apiListApplicationMeetings,
  apiCancelMeeting,
  ApiError,
  bootstrapSession,
  getUser,
  type Message,
  type MyApplication,
  type Meeting,
} from "@/lib/client/api";
import { statusClass, timeAgo, titleCase } from "@/lib/client/format";
import { MeetingList } from "@/components/meeting-list";

export default function ApplicationConversationPage() {
  const id = useParams<{ id: string }>().id;
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mine, setMine] = useState<MyApplication | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [cancelingMeetingId, setCancelingMeetingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const m = await apiListMessages(id);
      setMessages(m);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the conversation.");
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (!ok) return;
      await loadMessages();
      try {
        setMeetings(await apiListApplicationMeetings(id));
      } catch {
        /* optional - not every viewer of this route is a participant */
      }
      // Students also get a status header + withdraw (posters manage via pipeline).
      if (getUser()?.role === "STUDENT") {
        try {
          const apps = await apiListMyApplications();
          setMine(apps.find((a) => a.id === id) ?? null);
        } catch {
          /* header is optional */
        }
      }
    })();
  }, [id, loadMessages]);

  // Light polling so a reply appears without a manual refresh.
  useEffect(() => {
    if (!signedIn) return;
    const t = setInterval(() => void loadMessages(), 8000);
    return () => clearInterval(t);
  }, [signedIn, loadMessages]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const msg = await apiSendMessage(id, text);
      setMessages((prev) => [...prev, msg]);
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Message not sent.");
    } finally {
      setBusy(false);
    }
  }

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
        ? "Decline this offer? You were selected for this opportunity - withdrawing frees your seat for another applicant. This cannot be undone."
        : "Withdraw this application? This cannot be undone.";
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

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card"><h1>Sign in required</h1>
          <div className="hero-actions"><Link className="btn btn-primary" href="/login">Sign in</Link></div>
        </div>
      </main>
    );
  }

  const me = getUser();
  const isStudent = me?.role === "STUDENT";
  // Matches canWithdraw() in application-state.ts - withdrawal is allowed from
  // SELECTED too (declining an accepted offer), just not from an already
  // resolved REJECTED/WITHDRAWN state.
  const canWithdraw = isStudent && mine && !["REJECTED", "WITHDRAWN"].includes(mine.status);

  return (
    <div className="app-shell">
      <AppNav user={me} />
      <main id="content" className="app-page">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <Link href={isStudent ? "/applications" : "/opportunities"} className="back-link">
            ← Back
          </Link>

          <div className="page-head">
            <div>
              <h1>{mine ? mine.opportunity.title : "Conversation"}</h1>
              <p className="sub">Messages are scoped to this application - only you and the other party can see them.</p>
            </div>
            {mine && <span className={`pill ${statusClass(mine.status)}`}>{titleCase(mine.status)}</span>}
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {meetings.length > 0 && (
            <div className="panel-card" style={{ marginBottom: 16 }}>
              <h2>Meetings</h2>
              <MeetingList
                meetings={meetings}
                currentUserId={me?.id}
                busyId={cancelingMeetingId}
                onCancel={(meetingId) => void onCancelMeeting(meetingId)}
              />
            </div>
          )}

          <div className="panel">
            <div className="thread" ref={threadRef}>
              {messages.length === 0 ? (
                <p className="empty-note">No messages yet. Say hello.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.senderId === me?.id ? "me" : "them"}`}>
                    {m.body}
                    <span className="when">{timeAgo(m.createdAt)}</span>
                  </div>
                ))
              )}
            </div>

            <form className="composer" onSubmit={onSend}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                maxLength={4000}
                aria-label="Message"
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={busy || !draft.trim()}>
                Send
              </button>
            </form>
          </div>

          {canWithdraw && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-danger btn-sm" type="button" onClick={onWithdraw} disabled={busy}>
                {mine?.status === "SELECTED" ? "Decline offer" : "Withdraw application"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
