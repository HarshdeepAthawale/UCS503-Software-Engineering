-- T-36 (M9) — moderation flag queue (docs/PRD M9, Schema §6).
-- Members flag postings; an admin resolves or dismisses. A partial unique index
-- makes duplicate OPEN flags by the same reporter impossible at the DB layer.

CREATE TYPE "FlagReason" AS ENUM ('SPAM', 'MISLEADING', 'INAPPROPRIATE', 'DUPLICATE', 'OTHER');
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TABLE "flags" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "FlagReason" NOT NULL,
    "detail" TEXT,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "reviewed_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flags_status_created_at_idx" ON "flags"("status", "created_at");
CREATE INDEX "flags_opportunity_id_idx" ON "flags"("opportunity_id");

-- One OPEN flag per reporter per posting (constraint: no duplicate open reports).
CREATE UNIQUE INDEX "flags_one_open_per_reporter_per_opp"
    ON "flags" ("opportunity_id", "reporter_id")
    WHERE "status" = 'OPEN';

ALTER TABLE "flags" ADD CONSTRAINT "flags_opportunity_id_fkey"
    FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flags" ADD CONSTRAINT "flags_reporter_id_fkey"
    FOREIGN KEY ("reporter_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
