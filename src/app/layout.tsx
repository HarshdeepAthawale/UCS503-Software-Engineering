import type { ReactNode } from "react";

export const metadata = {
  title: "Thapar Nexus",
  description: "A verified opportunity pipeline for the institute.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
