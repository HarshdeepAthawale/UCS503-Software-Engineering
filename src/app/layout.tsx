import type { ReactNode } from "react";
import { headers } from "next/headers";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import "./globals.css";

/**
 * Root layout - Outfit (the exam portal's face) for all UI, IBM Plex Mono for
 * codes only. Light theme only; the tokens live in globals.css.
 */

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-mono",
  display: "swap",
});

export const metadata = {
  title: "Thapar Nexus",
  description:
    "The opportunities portal for Thapar Institute: research, internships, TA roles and teams, with every application tracked to a decision.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Reading the request headers opts every page into per-request rendering.
  // That is required, not incidental: the CSP in middleware.ts carries a fresh
  // nonce per request, and Next.js can only stamp it onto its own scripts when
  // the page is rendered for that request. A prerendered page would ship
  // scripts without the nonce, the browser would block them, and React would
  // never hydrate.
  await headers();

  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${outfit.variable} ${ibmPlexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
