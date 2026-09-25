-- A team lead can remove a role while editing the team. Removal is a soft
-- delete (project rule): the row, its join requests and its history stay.
ALTER TABLE "team_roles" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);
