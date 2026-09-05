# Same-origin split deploy (Vercel rewrite → Render)

The browser sits on Vercel; API, DB, and cron live on Render. Vercel `beforeFiles` rewrites `/api/*` to `BACKEND_ORIGIN` so the refresh cookie stays first-party (`SameSite=Strict`), CSP `connect-src 'self'` holds, and there is no CORS layer. A true cross-origin split would drop the session at access-token expiry. Cron hits Render directly (cron-job.org), not the frontend host.

Status: accepted (Tracker D-28). Supersedes D-21's assumption that the app host also schedules cron.
