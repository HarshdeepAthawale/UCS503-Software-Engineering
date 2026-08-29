-- T-37 (M2) — portfolio projects with repository links (docs/PRD M2, Schema §6).
-- Owner-managed, soft-deleted (deleted_at) so history and analytics survive.
-- FK to profiles(user_id) with ON DELETE CASCADE mirrors user_skills.
CREATE TABLE "profile_projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "repo_url" TEXT,
    "live_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "profile_projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "profile_projects_user_id_idx" ON "profile_projects"("user_id");

ALTER TABLE "profile_projects" ADD CONSTRAINT "profile_projects_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
