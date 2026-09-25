-- Admins + one super admin. Adding an enum value is its own migration: Postgres
-- cannot USE a value in the same transaction that adds it, and the runner
-- (scripts/apply-migrations.mjs) wraps each migration in one transaction.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
