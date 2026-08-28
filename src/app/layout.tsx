import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Root layout - Fraunces (display), Inter (UI/body), JetBrains Mono (labels).
 *
 * Three families and no more. Fraunces is used ONLY for display and only at
 * weight 400: this system distinguishes display type by tracking and a serif
 * face, never by weight. JetBrains Mono is a LABEL face here rather than a
 * code face - every nav item, eyebrow and meta line is uppercase mono at 11px,
 * which is the single most distinctive thing about the design.
 *
 * Fonts are self-hosted at build time, which keeps them compatible with
 * `font-src 'self'` in middleware.
 */

// Variable font: the whole optical range ships as one file, so no weight
// list is given. `opsz` is what makes Fraunces work at both 60px and 24px.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata = {
  title: "Thapar Nexus",
  description:
    "A verified opportunity pipeline for the institute - make sure an application reaches a decision, and make it visible when it doesn't.",
};

/**
 * Stamps `data-theme` on <html> BEFORE first paint, so the theme is always
 * explicit (never left to hydration timing) and there is no flash of the wrong
 * palette. Light is the default when nothing is stored and the OS has no
 * dark preference.
 */
const THEME_INIT = `(function(){try{var s=localStorage.getItem('nexus-theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Stamped by middleware.ts, which mints one nonce per request and puts the
  // same value in the Content-Security-Policy header. Without it this script
  // is blocked and the page paints in the wrong theme before React can
  // correct it - the flash this script exists to prevent.
  //
  // Reading a header opts the layout into dynamic rendering. That is a real
  // cost and it is accepted deliberately: the alternative is hash-allowlisting
  // inline scripts, which is what broke hydration across the whole site.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // The font variables belong on <html>, NOT on <body>.
    //
    // globals.css declares `--font-display: var(--font-fraunces), …` on
    // :root. A custom property's value is substituted at the element where it
    // is DECLARED, so that inner var() is resolved against :root - and while
    // next/font put --font-fraunces on <body>, :root could not see it
    // (properties inherit down, never up). --font-display therefore computed
    // to the guaranteed-invalid value, inherited down as invalid, and every
    // `font-family: var(--font-display)` in the app silently fell back to the
    // browser default.
    //
    // The symptom was that the entire site rendered in Times New Roman while
    // looking superficially plausible, because the display fallback stack
    // ends in `serif`. It predates the Fraunces/Inter swap - the same bug
    // applied to Newsreader and Plus Jakarta Sans.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <head>
        {/* `suppressHydrationWarning` is required, not cosmetic. The CSP spec
            has browsers blank the `nonce` content attribute once the element is
            parsed, so that injected markup cannot read the nonce back out and
            reuse it. React compares the server HTML against the live DOM and
            therefore always sees nonce="..." versus nonce="" here. The warning
            is unavoidable and the mismatch is the browser protecting the
            nonce, so it is silenced on this one element rather than left to
            train everyone to ignore hydration warnings. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT }}
        />
      </head>
      <body className="grain">{children}</body>
    </html>
  );
}
