-- Profile identity + availability fields (docs/PRD M2, structured profiles).
--
-- `role` on a profile is the ACCOUNT type (STUDENT/FACULTY/...), so nothing on
-- the profile said what a person actually works on. `headline` is that line.
-- The link columns give a reviewer the two destinations they always ask for
-- next (GitHub, LinkedIn) plus a personal site.
--
-- `open_to` reuses the OppType vocabulary rather than free text, so "open to
-- research" is the same token a posting carries and stays matchable later.
-- All nullable / empty-defaulted: existing profiles are untouched and valid.
-- IF NOT EXISTS on every clause: this migration's columns were previously
-- applied by hand on production without an _app_migrations row, so the
-- tracked run must be idempotent rather than fail on a column collision.
ALTER TABLE "profiles"
    ADD COLUMN IF NOT EXISTS "headline" TEXT,
    ADD COLUMN IF NOT EXISTS "github_url" TEXT,
    ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT,
    ADD COLUMN IF NOT EXISTS "website_url" TEXT,
    ADD COLUMN IF NOT EXISTS "open_to" "OppType"[] NOT NULL DEFAULT ARRAY[]::"OppType"[],
    ADD COLUMN IF NOT EXISTS "hours_per_week" INTEGER;
