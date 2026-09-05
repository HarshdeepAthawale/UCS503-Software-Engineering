import { requireHttpEntry } from "@/lib/http/catalog";
import { HttpStatusScreen } from "@/components/http-status-screen";

/**
 * App Router 404.
 *
 * Without this file Next has no App Router page to render for a missing route
 * and falls back to the Pages-router `/_error` document — which is what broke
 * the Render build with "<Html> should not be imported outside of
 * pages/_document" while prerendering /500 and /_error.
 */
export default function NotFound() {
  return <HttpStatusScreen entry={requireHttpEntry(404)} />;
}
