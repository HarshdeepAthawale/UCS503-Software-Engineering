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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${newsreader.variable} ${jakarta.variable} ${jetbrains.variable}`}>
        {children}
      </body>
    </html>
  );
}
