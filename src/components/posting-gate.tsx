"use client";

import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { SignInRequired } from "@/components/sign-in-required";
import { getUser } from "@/lib/client/api";
import type { PostingAccess } from "@/lib/client/nav";

/**
 * What a posting page shows to someone who cannot post, saying the true
 * reason: they are signed out, their alumni claim is still being reviewed, or
 * they are simply not a poster.
 */
export function PostingGate({ access }: { access: Exclude<PostingAccess, "ok"> }) {
  if (access === "signed-out") return <SignInRequired message="Sign in to post and manage opportunities." />;

  const pending = access === "pending";
  return (
    <div className="app-shell">
      <AppNav user={getUser()} />
      <main id="content" className="app-page">
        <div className="wrap page-stack">
          <div className="empty-card">
            <h3>{pending ? "Your alumni verification is still pending" : "Only faculty and verified alumni post opportunities"}</h3>
            <p>
              {pending
                ? "You can post as soon as an admin verifies your alumni claim."
                : "Students discover and apply; posting is for opportunity owners."}
            </p>
            <Link className="btn btn-ghost" href={pending ? "/alumni" : "/opportunities"}>
              {pending ? "Check verification status" : "← Back to feed"}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
