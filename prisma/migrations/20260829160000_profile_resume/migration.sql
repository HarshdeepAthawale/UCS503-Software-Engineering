-- T-44 (M2) — résumé metadata on profiles (docs/PRD M2, "Object Storage").
-- The PDF bytes live in Supabase Storage (private bucket, signed URLs); only the
-- pointer + display metadata are stored here. All nullable: null = no résumé.
ALTER TABLE "profiles"
    ADD COLUMN "resume_key" TEXT,
    ADD COLUMN "resume_name" TEXT,
    ADD COLUMN "resume_size" INTEGER,
    ADD COLUMN "resume_uploaded_at" TIMESTAMPTZ(6);
