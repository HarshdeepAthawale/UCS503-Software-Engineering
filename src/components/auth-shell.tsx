import type { ReactNode } from "react";

/**
 * Sign-in / registration frame: the campus photograph full-bleed, darkened
 * toward the bottom so white text and the frosted card stay legible, with the
 * card centred on top (same pattern as the institute's exam portal). The card
 * always renders in the light institute palette, whatever the app theme.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-photo">
      <div className="auth-photo-bg" aria-hidden="true" />
      {children}
      <p className="auth-photo-foot">Thapar Institute of Engineering and Technology, Patiala</p>
    </main>
  );
}
