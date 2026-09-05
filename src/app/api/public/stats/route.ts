import { handler, ok } from "@/lib/http/respond";
import { getPublicInstituteStats } from "@/lib/services/analytics.service";

export const runtime = "nodejs";

/** GET /api/public/stats — live institute aggregates for the landing monitor. No auth. */
export const GET = handler(async () => ok(await getPublicInstituteStats()));
