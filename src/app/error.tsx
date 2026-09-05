"use client";

import { useEffect } from "react";
import { requireHttpEntry } from "@/lib/http/catalog";
import { HttpStatusScreen } from "@/components/http-status-screen";

/**
 * App Router error boundary for anything thrown while rendering a route.
 *
 * Nothing from `error` is rendered: a server-side message can carry internals.
 * The digest is the safe handle — it correlates to the server log without
 * disclosing anything itself.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <HttpStatusScreen
      entry={requireHttpEntry(500)}
      reference={error.digest}
      retry={reset}
    />
  );
}
