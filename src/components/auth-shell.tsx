import Link from "next/link";
import type { ReactNode } from "react";
import { TiLogo } from "@/components/ti-logo";

/**
 * Two-column auth layout — minimal branded panel, form on the right.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-split">
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <Link className="brand" href="/">
            <TiLogo size={34} className="ti-mark" />
            <span>Thapar&nbsp;Nexus</span>
          </Link>
          <h2>Sign in to your pipeline.</h2>
          <p className="auth-aside-lede">
            Postings, applications, and decisions — all in one place.
          </p>
        </div>
      </aside>
      <div className="auth-main">{children}</div>
    </main>
  );
}
