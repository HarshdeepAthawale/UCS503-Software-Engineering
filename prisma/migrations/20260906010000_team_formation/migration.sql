-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('FORMING', 'LOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TeamRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "hackathon" TEXT NOT NULL,
    "description" TEXT,
    "event_date" TIMESTAMPTZ(6),
    "status" "TeamStatus" NOT NULL DEFAULT 'FORMING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_roles" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "slot_count" INTEGER NOT NULL,
    "slots_filled" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_roles_pkey" PRIMARY KEY ("id"),
    -- Mirrors constraint 4 on opportunities: slots can never be over-allocated.
    CONSTRAINT "team_role_slots_within_capacity" CHECK ("slots_filled" <= "slot_count")
);

-- CreateTable
CREATE TABLE "team_role_skills" (
    "team_role_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "team_role_skills_pkey" PRIMARY KEY ("team_role_id","skill_id")
);

-- CreateTable
CREATE TABLE "team_join_requests" (
    "id" UUID NOT NULL,
    "team_role_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "message" TEXT,
    "status" "TeamRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_code" "RejectionCode",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateIndex
CREATE INDEX "teams_lead_id_idx" ON "teams"("lead_id");

-- CreateIndex
CREATE INDEX "teams_status_idx" ON "teams"("status");

-- CreateIndex
CREATE INDEX "team_roles_team_id_idx" ON "team_roles"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_join_requests_team_role_id_student_id_key" ON "team_join_requests"("team_role_id", "student_id");

-- CreateIndex
CREATE INDEX "team_join_requests_student_id_idx" ON "team_join_requests"("student_id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_roles" ADD CONSTRAINT "team_roles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_role_skills" ADD CONSTRAINT "team_role_skills_team_role_id_fkey" FOREIGN KEY ("team_role_id") REFERENCES "team_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_role_skills" ADD CONSTRAINT "team_role_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_team_role_id_fkey" FOREIGN KEY ("team_role_id") REFERENCES "team_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "team_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
