-- Identity v2 — faculty roster allowlist (docs/Identity-and-Admin-Plan.md §2).
-- Citext so the email match is case-insensitive, exactly like users.email.
CREATE TABLE "faculty_allowlist" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faculty_allowlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "faculty_allowlist_email_key" ON "faculty_allowlist"("email");
