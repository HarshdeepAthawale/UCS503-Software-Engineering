-- Backlog eligibility filter (docs/PRD M3), alongside branch/CGPA: a poster
-- can cap how many ACTIVE backlogs an applicant may have (e.g. 0, 1, 2...).
--
-- `profiles.backlogs` is the student's self-reported count; `opportunities.
-- max_backlogs` is the poster's cap, null = no cap. Both additive/nullable -
-- every existing row keeps its current (unrestricted) behaviour.
ALTER TABLE "profiles"
    ADD COLUMN "backlogs" INTEGER;

ALTER TABLE "opportunities"
    ADD COLUMN "max_backlogs" INTEGER;
