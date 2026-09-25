"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { Conversation } from "@/components/conversation";
import { NavIcon } from "@/components/nav-icon";
import { SignInRequired } from "@/components/sign-in-required";
import { apiListMyThreads, bootstrapSession, getUser, type MessageThreadSummary } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";
import { awaitingReply, threadMatches } from "@/lib/client/messages";
import { initials } from "@/lib/client/nav";

/**
 * Inbox. One conversation per application (messaging is scoped to an
 * application - there are no free-form DMs). Desktop shows the list and the
 * open conversation side by side; a phone shows one at a time. The open
 * thread is in the URL (?thread=<applicationId>) so a link opens it directly.
 */
export default function MessagesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      if (ok) {
        try {
          const threads = await apiListMyThreads();
          setThreads(threads);
          const fromUrl = new URLSearchParams(window.location.search).get("thread");
          // Desktop opens the newest conversation straight away; a phone
          // starts on the list unless a link named a thread.
          const wide = window.matchMedia("(min-width: 769px)").matches;
          setOpenId(fromUrl ?? (wide ? threads[0]?.applicationId ?? null : null));
        } catch (err) {
          if (!handleLoadError(router, err)) setError(loadErrorMessage(err, "Could not load your conversations."));
        }
      }
      setReady(true);
    })();
  }, [router]);

  function open(id: string | null) {
    setOpenId(id);
    router.replace(id ? `/messages?thread=${id}` : "/messages", { scroll: false });
  }

  if (ready && !signedIn) return <SignInRequired message="Sign in to view your conversations." />;

  const me = getUser();
  const isStudent = me?.role === "STUDENT";
  const shown = threads.filter((t) => threadMatches(t, query));
  const owed = threads.filter((t) => awaitingReply(t, me?.id)).length;

  return (
    <div className="app-shell">
      <AppNav user={me} />
      <main id="content" className="app-page">
        <div className="wrap page-stack">
          <div className="page-title-row">
            <div>
              <h1>Messages</h1>
              <p className="sub">
                One conversation per application{owed > 0 ? ` · ${owed} awaiting your reply` : ""}.
              </p>
            </div>
          </div>

          {error && <p className="form-err" role="alert">{error}</p>}

          {!ready ? (
            <div className="skeleton inbox-skeleton" aria-busy="true" />
          ) : threads.length === 0 ? (
            <div className="empty-card">
              <h3>No conversations yet</h3>
              <p>
                {isStudent
                  ? "Once you apply, you can message the poster from the application - it will appear here."
                  : "When you or an applicant sends a message about an application, it will appear here."}
              </p>
              <Link className="btn btn-primary" href={isStudent ? "/applications" : "/opportunities/mine"}>
                {isStudent ? "Go to my applications" : "Go to my postings"}
              </Link>
            </div>
          ) : (
            <div className={`inbox${openId ? " has-open" : ""}`}>
              <aside className="inbox-list" aria-label="Conversations">
                <div className="search-input inbox-search">
                  <NavIcon name="search" size={16} />
                  <label htmlFor="thread-search" className="sr-only">Search conversations</label>
                  <input id="thread-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people or postings" />
                </div>
                <ul>
                  {shown.map((t) => {
                    const owesReply = awaitingReply(t, me?.id);
                    const fromMe = t.lastMessage.senderId === me?.id;
                    return (
                      <li key={t.applicationId}>
                        <button type="button" className={`thread${t.applicationId === openId ? " is-open" : ""}`}
                          aria-current={t.applicationId === openId ? "true" : undefined}
                          onClick={() => open(t.applicationId)}>
                          <span className="avatar" aria-hidden="true">{initials(t.counterpart.name)}</span>
                          <span className="thread-main">
                            <span className="thread-top">
                              <strong>{t.counterpart.name}</strong>
                              <time dateTime={t.lastMessage.createdAt}>{timeAgo(t.lastMessage.createdAt)}</time>
                            </span>
                            <span className="thread-posting">{t.opportunity.title}</span>
                            <span className="thread-preview">
                              {fromMe ? "You: " : ""}{t.lastMessage.body}
                            </span>
                          </span>
                          {owesReply && <span className="reply-dot" title="Awaiting your reply" aria-label="Awaiting your reply" />}
                        </button>
                      </li>
                    );
                  })}
                  {shown.length === 0 && <li className="inbox-none">No conversation matches “{query.trim()}”.</li>}
                </ul>
              </aside>

              <div className="inbox-pane">
                {openId && me ? (
                  <Conversation
                    key={openId}
                    applicationId={openId}
                    myId={me.id}
                    onBack={() => open(null)}
                    onSent={(m) =>
                      setThreads((prev) => {
                        const t = prev.find((x) => x.applicationId === openId);
                        if (!t) return prev;
                        const updated = { ...t, lastMessage: { body: m.body, createdAt: m.createdAt, senderId: m.senderId, senderName: m.senderName } };
                        return [updated, ...prev.filter((x) => x.applicationId !== openId)];
                      })
                    }
                  />
                ) : (
                  <div className="inbox-placeholder">Choose a conversation.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
