import { ok } from "@/lib/http/respond";

export const runtime = "nodejs";

/** GET /api/health - liveness probe for CI/deploy checks. No auth, no secrets. */
export const GET = () => ok({ status: "ok", service: "thapar-nexus", phase: 1 });
