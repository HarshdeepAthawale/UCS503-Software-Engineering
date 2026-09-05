"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  apiListMyThreads,
  ApiError,
  bootstrapSession,
  getUser,
  type MessageThreadSummary,
} from "@/lib/client/api";
import { statusClass, timeAgo, titleCase } from "@/lib/client/format";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";
import { SignInRequired } from "@/components/sign-in-required";

function threadTitle(t: MessageThreadSummary, isStudent: boolean): string {
  return isStudent ? t.poster.name : t.student.name;
}

function threadPreview(t: MessageThreadSummary, myId: string | undefined): string {
  const fromMe = t.lastMessage.senderId === myId;
  const prefix = fromMe ? "You: " : `${t.lastMessage.senderName}: `;
  const body =
    t.lastMessage.body.length > 72 ? `${t.lastMessage.body.slice(0, 72)}…` : t.lastMessage.body;
  return `${prefix}${body}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function MessagesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (ok) {
        try {
          setThreads(await apiListMyThreads());
        } catch (err) {
          if (handleLoadError(router, err)) return;
          setError(loadErrorMessage(err, "Could not load your conversations."));
        }
      }
    })();
  }, []);

  if (!ready) return <main className="app-shell"><p className="app-loading">Loading…</p></main>;
  if (!signedIn) {
    return <SignInRequired message="Sign in to view your conversations." />;
  }

  const me = getUser();
  const isStudent = me?.role === "STUDENT";

  return (
    <div className="app-shell">
      <AppNav user={me} />
      <main id="content" className="app-page">
        <div className="wrap wrap-narrow">
          <div className="page-head">
            <div>
              <h1>Messages</h1>
              <p className="sub">
                {isStudent
                  ? "One thread per application — each professor you message appears by name."
                  : "One thread per application — each student who messages you appears by name."}
              </p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {threads.length === 0 ? (
            <div className="app-empty">
              <h3>No conversations yet</h3>
              <p>
                {isStudent
                  ? "Message a professor from one of your applications and it'll show up here."
                  : "When a student messages you about an application, their name will appear here."}
              </p>
            </div>
          ) : (
            <div className="msg-thread-list">
              {threads.map((t) => {
                const title = threadTitle(t, isStudent);
                return (
                  <Link
                    key={t.applicationId}
                    href={`/applications/${t.applicationId}`}
                    className="msg-thread-item"
                  >
                    <span className="msg-thread-avatar" aria-hidden="true">{initials(title)}</span>
                    <span className="msg-thread-body">
                      <span className="msg-thread-top">
                        <span className="msg-thread-name">{title}</span>
                        <span className="msg-thread-time">{timeAgo(t.lastMessage.createdAt)}</span>
                      </span>
                      <span className="msg-thread-sub">{t.opportunity.title}</span>
                      <span className="msg-thread-preview">{threadPreview(t, me?.id)}</span>
                    </span>
                    <span className={`pill pill-sm ${statusClass(t.status)}`}>{titleCase(t.status)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
