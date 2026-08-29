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
ALTER TABLE "profiles"
    ADD COLUMN "headline" TEXT,
    ADD COLUMN "github_url" TEXT,
    ADD COLUMN "linkedin_url" TEXT,
    ADD COLUMN "website_url" TEXT,
    ADD COLUMN "open_to" "OppType"[] NOT NULL DEFAULT ARRAY[]::"OppType"[],
    ADD COLUMN "hours_per_week" INTEGER;
