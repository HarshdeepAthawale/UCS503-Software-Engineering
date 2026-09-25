"use client";

import { isAdminRole } from "@/lib/domain/admin-portal";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ResumeViewer } from "@/components/resume-viewer";
import {
  apiGetProfile,
  ApiError,
  bootstrapSession,
  getUser,
  type OppType,
  type Profile,
} from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import { handleLoadError, loadErrorMessage } from "@/lib/client/handle-load-error";

/** Display labels for the posting-type vocabulary used by `openTo`. */
const OPEN_TO_LABEL: Record<OppType, string> = {
  RESEARCH: "Research",
  INTERNSHIP: "Internship",
  TA: "TA",
  HACKATHON_TEAM: "Hackathon team",
  MICRO_TASK: "Micro-task",
  REFERRAL: "Referral",
};

/**
 * Read-only member profile (`/profile/<userId>`) — the counterpart to
 * `/profile`, which only ever shows you yourself.
 *
 * Until this page existed a faculty member could reach a student's résumé only
 * through the applicant pipeline of their own posting, so a student who had not
 * applied to them was invisible. The API and the RBAC matrix already supported
 * the lookup (`GET /api/profiles/:userId`, `profile:read_resume`); only the
 * screen was missing.
 *
 * Nothing here is a security boundary. The server has already stripped what the
 * viewer may not see — CGPA unless the student made it public, `resume` unless
 * the viewer holds `profile:read_resume` — so this renders whatever arrives and
 * simply omits the empty parts.
 */
export default function MemberProfilePage() {
  const userId = useParams<{ userId: string }>().userId;
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await apiGetProfile(userId);
      if (p) setProfile(p);
      else setNotFound(true);
    } catch (err) {
      if (handleLoadError(router, err)) return;
      setError(loadErrorMessage(err, "Could not load this profile."));
    }
  }, [userId, router]);

  useEffect(() => {
    void (async () => {
      const ok = await bootstrapSession();
      setSignedIn(ok);
      setReady(true);
      if (ok) await load();
    })();
  }, [load]);

  if (!ready) {
    return (
      <main className="app-shell">
        <p className="app-loading">Loading…</p>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in required</h1>
          <p className="sub">Profiles are visible to members of the institute community.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/">
              Sign in
            </Link>
            <Link className="btn btn-ghost" href="/register">
              Create account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const viewer = getUser();
  const isSelf = viewer?.id === userId;
  // Whether to show an empty résumé panel at all. A viewer without the grant
  // gets `resume: null` for "not shared" and for "never uploaded" alike, so the
  // panel is hidden entirely rather than hinting which one it is. This mirrors
  // AppNav: it hides what a role cannot do, it does not enforce it.
  const maySeeResumes =
    isSelf ||
    viewer?.role === "FACULTY" ||
    viewer?.role === "ALUMNI" ||
    (!!viewer && isAdminRole(viewer.role));

  // Only the links this member actually filled in. Every one is user-supplied,
  // so they all carry rel="noopener noreferrer"; the schema layer has already
  // restricted them to http(s).
  const links = [
    { label: "GitHub", href: profile?.githubUrl },
    { label: "LinkedIn", href: profile?.linkedinUrl },
    { label: "Website", href: profile?.websiteUrl },
  ].filter((l): l is { label: string; href: string } => !!l.href);

  return (
    <div className="app-shell">
      <AppNav user={viewer} />
      <main id="content" className="profile-shell">
        <div className="wrap">
          {error && (
            <p className="form-err" role="alert">
              {error}
            </p>
          )}

          {notFound ? (
            <div className="app-empty">
              <h3>Profile not found</h3>
              <p>This member has no profile, or the link is wrong.</p>
            </div>
          ) : !profile ? (
            <p className="app-loading">Loading profile…</p>
          ) : (
            <>
              <div className="profile-head">
                <div>
                  <span className="role">{profile.role}</span>
                  <h1>{profile.name}</h1>
                  {profile.headline && <p className="sub">{profile.headline}</p>}
                  <div className="mono-id">
                    {[profile.branch, profile.year ? `Year ${profile.year}` : null]
                      .filter(Boolean)
                      .join(" · ") || "No branch or year set"}
                  </div>
                  {links.length > 0 && (
                    <div className="proj-links" style={{ marginTop: 8 }}>
                      {links.map((l) => (
                        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {isSelf && (
                  <Link className="btn btn-ghost" href="/profile">
                    Edit my profile
                  </Link>
                )}
              </div>

              <div className="panel-grid">
                <div className="panel-card">
                  <h2>About</h2>
                  {profile.bio ? (
                    <p className="sub">{profile.bio}</p>
                  ) : (
                    <p className="empty-note">No bio yet.</p>
                  )}
                  {profile.cgpa != null && (
                    <p className="sub" style={{ marginTop: 12 }}>
                      CGPA <strong>{profile.cgpa}</strong>
                    </p>
                  )}
                  {profile.backlogs != null && (
                    <p className="sub" style={{ marginTop: 12 }}>
                      Active backlogs <strong>{profile.backlogs}</strong>
                    </p>
                  )}
                  {(profile.openTo.length > 0 || profile.hoursPerWeek != null) && (
                    <div style={{ marginTop: 16 }}>
                      <p className="empty-note" style={{ marginBottom: 8 }}>
                        Open to
                      </p>
                      <div className="skills-current">
                        {profile.openTo.map((t) => (
                          <span key={t} className="skill-chip">
                            {OPEN_TO_LABEL[t] ?? t}
                          </span>
                        ))}
                      </div>
                      {profile.hoursPerWeek != null && (
                        <p className="empty-note" style={{ marginTop: 8 }}>
                          About {profile.hoursPerWeek} hours a week.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="panel-card">
                  <h2>Skills</h2>
                  <div className="skills-current">
                    {profile.skills.length === 0 && (
                      <p className="empty-note">No skills listed yet.</p>
                    )}
                    {profile.skills.map((s) => (
                      <span
                        key={s.id}
                        className={`skill-chip${s.attestation ? " skill-chip-verified" : ""}`}
                        title={
                          s.attestation
                            ? `Verified by ${s.attestation.issuerName} (${s.attestation.issuerRole.toLowerCase()}) — ${s.attestation.context}`
                            : `${s.domain} · ${s.proficiency.toLowerCase()}`
                        }
                      >
                        {s.attestation && "✔ "}
                        {s.name} · {s.proficiency.toLowerCase()}
                      </span>
                    ))}
                  </div>
                  {profile.skills.some((s) => s.attestation) && (
                    <ul className="attestation-list" style={{ marginTop: 12 }}>
                      {profile.skills
                        .filter((s) => s.attestation)
                        .map((s) => (
                          <li key={s.id} className="empty-note">
                            <strong>{s.name}</strong> verified by {s.attestation!.issuerName} (
                            {s.attestation!.issuerRole.toLowerCase()}) — {s.attestation!.context}
                          </li>
                        ))}
                    </ul>
                  )}
                  {profile.skills.some((s) => !s.attestation) && (
                    <p className="empty-note" style={{ marginTop: 12 }}>
                      Unmarked skills are self-claimed until an attestation verifies them.
                    </p>
                  )}
                </div>
              </div>

              {maySeeResumes && (
                <div className="panel-grid">
                  <div className="panel-card">
                    <h2>Résumé</h2>
                    {profile.resume ? (
                      <>
                        {/* Freshness matters to a reviewer: a résumé last
                            touched two years ago reads very differently from
                            one updated last week. */}
                        {profile.resume.uploadedAt && (
                          <p className="empty-note" style={{ marginBottom: 12 }}>
                            Updated {timeAgo(profile.resume.uploadedAt)}
                          </p>
                        )}
                        <ResumeViewer userId={profile.userId} />
                      </>
                    ) : (
                      <p className="empty-note">No résumé uploaded.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="panel-grid">
                <div className="panel-card">
                  <h2>Projects</h2>
                  <div className="proj-list">
                    {profile.projects.length === 0 && (
                      <p className="empty-note">No projects yet.</p>
                    )}
                    {profile.projects.map((p) => (
                      <div key={p.id} className="proj-row">
                        <div className="proj-main">
                          <strong>{p.title}</strong>
                          {p.description && <p className="sub">{p.description}</p>}
                          <div className="proj-links">
                            {p.repoUrl && (
                              <a href={p.repoUrl} target="_blank" rel="noopener noreferrer">
                                Repository
                              </a>
                            )}
                            {p.liveUrl && (
                              <a href={p.liveUrl} target="_blank" rel="noopener noreferrer">
                                Live
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
