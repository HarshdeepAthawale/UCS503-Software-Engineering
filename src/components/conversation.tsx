"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  apiListMessages,
  apiSendMessage,
  ApiError,
  type Message,
  type MessageThreadContext,
} from "@/lib/client/api";
import { dayLabel, groupByDay, timeOfDay } from "@/lib/client/messages";
import { initials } from "@/lib/client/nav";
import { appStateLabel } from "@/lib/domain/app-state-label";

/** How often an open conversation checks for replies while the tab is visible. */
const POLL_MS = 8000;
const MAX_LENGTH = 4000; // mirrors MessageSendSchema

/**
 * One application's conversation: who is on the other side, which posting it
 * is about and where the application stands, the messages grouped by day, and
 * a composer (Enter sends, Shift+Enter adds a line). Polls for replies only
 * while the tab is visible.
 */
export function Conversation({
  applicationId,
  myId,
  onBack,
  onSent,
}: {
  applicationId: string;
  myId: string;
  /** Phone layout: return to the thread list. */
  onBack?: () => void;
  /** Lets the inbox move this thread to the top. */
  onSent?: (m: Message) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<MessageThreadContext | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiListMessages(applicationId);
      setMessages(res.messages);
      setContext(res.context);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this conversation.");
    }
  }, [applicationId]);

  useEffect(() => {
    setMessages([]);
    setContext(null);
    setError(null);
    setDraft("");
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const m = await apiSendMessage(applicationId, text);
      setMessages((prev) => [...prev, m]);
      setDraft("");
      onSent?.(m);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Message not sent.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  const other = context ? (context.student.id === myId ? context.poster : context.student) : null;

  return (
    <section className="conversation" aria-label={other ? `Conversation with ${other.name}` : "Conversation"}>
      <header className="conversation-head">
        {onBack && (
          <button type="button" className="btn btn-text conversation-back" onClick={onBack} aria-label="Back to conversations">
            ←
          </button>
        )}
        {other && <span className="avatar" aria-hidden="true">{initials(other.name)}</span>}
        <div className="conversation-who">
          <strong>{other?.name ?? "…"}</strong>
          {context && (
            <Link href={`/opportunities/${context.opportunity.id}`} className="conversation-posting">
              {context.opportunity.title}
            </Link>
          )}
        </div>
        {context && (
          <span className={`stage-pill s-${context.status.toLowerCase()}`}>{appStateLabel(context.status)}</span>
        )}
      </header>

      <div className="conversation-body" ref={scroller}>
        {error && <p className="form-err" role="alert">{error}</p>}
        {context && messages.length === 0 && (
          <p className="conversation-empty">No messages yet. Say hello - keep it about this application.</p>
        )}
        {groupByDay(messages).map((g) => (
          <div key={g.key} className="day-group">
            <p className="day-label"><span>{dayLabel(g.date)}</span></p>
            {g.messages.map((m) => {
              const mine = m.senderId === myId;
              return (
                <div key={m.id} className={`bubble-row${mine ? " is-mine" : ""}`}>
                  <div className="bubble">
                    <p>{m.body}</p>
                    <time dateTime={m.createdAt}>{timeOfDay(m.createdAt)}</time>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <form className="composer-bar" onSubmit={(e) => void send(e)}>
        <label htmlFor={`compose-${applicationId}`} className="sr-only">Message</label>
        <textarea
          id={`compose-${applicationId}`}
          rows={1}
          value={draft}
          maxLength={MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={other ? `Message ${other.name.split(" ")[0]}…` : "Write a message…"}
          disabled={!context}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy || !draft.trim()}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
