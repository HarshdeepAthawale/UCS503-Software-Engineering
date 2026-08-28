-- CreateEnum
CREATE TYPE "OppType" AS ENUM ('RESEARCH', 'INTERNSHIP', 'TA', 'HACKATHON_TEAM', 'MICRO_TASK', 'REFERRAL');

-- CreateEnum
CREATE TYPE "OppStatus" AS ENUM ('DRAFT', 'LIVE', 'AT_RISK', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SlaPledge" AS ENUM ('H24', 'H48', 'WEEK');

-- CreateEnum
CREATE TYPE "AppState" AS ENUM ('APPLIED', 'RECEIVED', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RejectionCode" AS ENUM ('SKILL_MISMATCH', 'SEATS_FILLED', 'TIMING_CONFLICT', 'PROFILE_INCOMPLETE', 'STRONGER_APPLICANTS', 'OTHER');

-- CreateEnum
CREATE TYPE "NotifFreq" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "poster_id" UUID NOT NULL,
    "type" "OppType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "duration" TEXT,
    "stipend" BOOLEAN NOT NULL DEFAULT false,
    "seat_count" INTEGER NOT NULL DEFAULT 1,
    "seats_filled" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMPTZ(6) NOT NULL,
    "sla_pledge" "SlaPledge" NOT NULL,
    "status" "OppStatus" NOT NULL DEFAULT 'LIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id"),
    -- Constraint 4 (docs/Schema.md §6): seats can never be over-allocated.
    CONSTRAINT "seats_within_capacity" CHECK ("seats_filled" <= "seat_count")
);

-- CreateTable
CREATE TABLE "opportunity_skills" (
    "opportunity_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "requirement" "SkillRequirement" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_skills_pkey" PRIMARY KEY ("opportunity_id","skill_id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "AppState" NOT NULL DEFAULT 'APPLIED',
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_transition_at" TIMESTAMPTZ(6),
    "rejection_code" "RejectionCode",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_events" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "from_state" "AppState",
    "to_state" "AppState" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunities_poster_id_idx" ON "opportunities"("poster_id");

-- CreateIndex
CREATE INDEX "opportunities_status_idx" ON "opportunities"("status");

-- CreateIndex
CREATE INDEX "opportunities_deadline_idx" ON "opportunities"("deadline");

-- CreateIndex
CREATE INDEX "opportunities_type_domain_stipend_idx" ON "opportunities"("type", "domain", "stipend");

-- CreateIndex
CREATE INDEX "applications_opportunity_id_idx" ON "applications"("opportunity_id");

-- CreateIndex
CREATE INDEX "applications_student_id_idx" ON "applications"("student_id");

-- CreateIndex
CREATE INDEX "application_events_application_id_idx" ON "application_events"("application_id");

-- Constraint 3 (docs/Schema.md §6): one LIVE application per student per
-- opportunity. Partial unique index — soft-deleted rows don't block a re-apply.
CREATE UNIQUE INDEX "uq_one_live_app"
    ON "applications"("opportunity_id", "student_id")
    WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_poster_id_fkey" FOREIGN KEY ("poster_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_skills" ADD CONSTRAINT "opportunity_skills_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_skills" ADD CONSTRAINT "opportunity_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
