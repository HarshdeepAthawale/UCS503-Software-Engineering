import type { ReactNode } from "react";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Root layout — loads the warm-dark editorial type stack via next/font/google.
 * Fonts are self-hosted at build time, which keeps them compatible with the
 * strict CSP (`font-src 'self'`) set in src/middleware.ts.
 */

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    "A verified opportunity pipeline for the institute — make sure an application reaches a decision, and make it visible when it doesn't.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}>
        {children}
      </body>
    </html>
  );
}
