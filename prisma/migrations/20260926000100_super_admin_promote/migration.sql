-- The existing administrator becomes the super admin. If several ADMIN rows
-- exist, the earliest-created live one is promoted; the rest stay ADMIN.
UPDATE "users"
SET "role" = 'SUPER_ADMIN', "updated_at" = now()
WHERE "id" = (
  SELECT "id" FROM "users"
  WHERE "role" = 'ADMIN' AND "deleted_at" IS NULL
  ORDER BY "created_at" ASC
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "users" WHERE "role" = 'SUPER_ADMIN' AND "deleted_at" IS NULL);

-- There is only ever one live super admin - enforced by the database, not by
-- application code that a future change could forget.
CREATE UNIQUE INDEX "one_super_admin" ON "users" ("role")
WHERE "role" = 'SUPER_ADMIN' AND "deleted_at" IS NULL;
