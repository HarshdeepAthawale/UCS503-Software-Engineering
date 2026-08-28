import type { ReactNode } from "react";
import { Newsreader, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Root layout — Newsreader (editorial serif display) + Plus Jakarta Sans
 * (geometric sans for all UI/body). Fonts are self-hosted at build time, which
 * keeps them compatible with the strict CSP (`font-src 'self'`) in middleware.
 */

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
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
    "A verified opportunity pipeline for the institute — make sure an application reaches a decision, and make it visible when it doesn't.",
};

/**
 * Stamps `data-theme` on <html> BEFORE first paint, so the theme is always
 * explicit (never left to hydration timing) and there is no flash of the wrong
 * palette. Light is the default when nothing is stored and the OS has no
 * dark preference.
 */
const THEME_INIT = `(function(){try{var s=localStorage.getItem('nexus-theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${newsreader.variable} ${jakarta.variable} ${jetbrains.variable}`}>
        {children}
      </body>
    </html>
  );
}
