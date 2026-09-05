-- CreateTable
CREATE TABLE "attestations" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "issuer_id" UUID NOT NULL,
    "context" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attestations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attestations_application_id_skill_id_key" ON "attestations"("application_id", "skill_id");

-- CreateIndex
CREATE INDEX "attestations_skill_id_idx" ON "attestations"("skill_id");

-- AddForeignKey
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraint 1 (docs/Schema.md §6, the "unfarmable" rule): an attestation may
-- only be inserted against an application whose status is SELECTED at that
-- moment. A plain CHECK can't query another table, so this is a constraint
-- trigger — DB-enforced, bypassing it requires bypassing the database itself,
-- not just the service layer. Deliberately does NOT also constrain UPDATEs on
-- `applications` (unlike a composite-FK-to-a-redundant-status-column trick
-- would): a SELECTED application can still legitimately transition to
-- WITHDRAWN later (declining an offer) even after an attestation exists for
-- it — the trigger only gates the moment of attestation insertion.
CREATE OR REPLACE FUNCTION attestation_requires_selected_application()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "applications"
    WHERE "id" = NEW."application_id" AND "status" = 'SELECTED'
  ) THEN
    RAISE EXCEPTION 'ATTESTATION_REQUIRES_SELECTION: application % is not SELECTED', NEW."application_id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "attestations_require_selected"
  AFTER INSERT ON "attestations"
  FOR EACH ROW EXECUTE FUNCTION attestation_requires_selected_application();
