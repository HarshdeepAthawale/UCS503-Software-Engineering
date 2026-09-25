import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { RESUME_CONTENT_TYPE } from "@/lib/domain/resume";
import { Errors } from "@/lib/http/errors";

/**
 * Résumé object storage on Supabase Storage (T-44; docs/PRD M2).
 *
 * SERVER ONLY. The service-role key bypasses row-level security, so this module
 * must never be imported into client code. The bucket is PRIVATE — files are
 * reachable only through short-lived signed URLs minted here, never a public
 * link (codeguard-0-authorization / sensitive-data-exposure).
 *
 * One object per user at `<userId>.pdf`, overwritten on re-upload, so a profile
 * holds exactly one current résumé and there is nothing to garbage-collect.
 */

/** True when both the URL and the service-role key are configured. */
export function resumeStorageConfigured(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase Storage is not configured.");
  }
  if (!cached) {
    cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

/** Storage object key for a user's single résumé. */
export function resumeKeyFor(userId: string): string {
  return `${userId}.pdf`;
}

/** Upload (or overwrite) a user's résumé. Returns the stored object key. */
export async function uploadResumeObject(userId: string, bytes: Buffer): Promise<string> {
  const key = resumeKeyFor(userId);
  const { error } = await client()
    .storage.from(env.SUPABASE_RESUME_BUCKET)
    .upload(key, bytes, { contentType: RESUME_CONTENT_TYPE, upsert: true });
  if (error) {
    // Log the provider's reason for the operator; tell the member plainly that
    // the fault is on our side, rather than an opaque "Something went wrong".
    console.error(`[resume-storage] upload failed: ${error.message}`);
    throw Errors.internal("Résumé storage is unavailable right now. Please try again later.");
  }
  return key;
}

/**
 * Mint a short-lived signed URL for a résumé object. `download` (a filename)
 * makes the link download as an attachment; omit it for an inline preview.
 * Default TTL is 5 minutes — long enough to open, short enough not to leak.
 */
export async function signResumeUrl(
  key: string,
  opts: { download?: string; expiresIn?: number } = {},
): Promise<string> {
  const { data, error } = await client()
    .storage.from(env.SUPABASE_RESUME_BUCKET)
    .createSignedUrl(key, opts.expiresIn ?? 300, opts.download ? { download: opts.download } : {});
  if (error || !data) throw new Error(`Could not sign résumé URL: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

/** Delete a user's résumé object. Treated as success if it is already gone. */
export async function removeResumeObject(userId: string): Promise<void> {
  const { error } = await client()
    .storage.from(env.SUPABASE_RESUME_BUCKET)
    .remove([resumeKeyFor(userId)]);
  if (error) throw new Error(`Résumé delete failed: ${error.message}`);
}
