-- T-11 — Full-text discovery for opportunities (docs/ImplementationPlan §3, M4).
-- A GIN index over an English tsvector of title + description makes keyword
-- search sub-linear, keeping p95 well under the 300ms discovery budget at pilot
-- scale. The expression matches the one used at query time (websearch_to_tsquery
-- against to_tsvector('english', title || ' ' || description)).
CREATE INDEX IF NOT EXISTS "opportunities_fts_idx"
  ON "opportunities"
  USING GIN (
    to_tsvector(
      'english',
      coalesce("title", '') || ' ' || coalesce("description", '')
    )
  );
