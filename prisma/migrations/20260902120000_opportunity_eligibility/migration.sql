-- Opportunity eligibility filters (docs/PRD M3): a poster can restrict a
-- posting to a set of branches and/or a minimum CGPA.
--
-- `eligible_branches` is plain TEXT[], not a DB enum, matching `profiles.branch`
-- (also plain text) - the fixed vocabulary lives in src/lib/domain/branch.ts and
-- is enforced at the Zod layer, so tightening it never needs a migration.
-- Both columns are additive with safe defaults: every existing posting keeps
-- its current (unrestricted) behaviour.
ALTER TABLE "opportunities"
    ADD COLUMN "eligible_branches" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "min_cgpa" DECIMAL(3, 2);
