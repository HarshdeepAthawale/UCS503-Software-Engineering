-- T-12 — one application per student per opportunity (constraint 3, docs/Schema §6).
-- Partial unique index over non-deleted rows: the database itself makes a
-- double-apply race impossible, independent of any application-layer check.
CREATE UNIQUE INDEX IF NOT EXISTS "applications_one_per_student_per_opp"
  ON "applications" ("opportunity_id", "student_id")
  WHERE "deleted_at" IS NULL;

-- Budget counting reads a student's active applications by state; this composite
-- index keeps that count index-only at scale.
CREATE INDEX IF NOT EXISTS "applications_student_status_idx"
  ON "applications" ("student_id", "status");
