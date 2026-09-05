#!/usr/bin/env node
/**
 * Prints the exact Google OAuth origins and redirect URIs to register.
 * Run: node --env-file=.env scripts/google-oauth-uris.mjs
 */

const local = "http://localhost:3000";
const prod = process.env.APP_ORIGIN?.replace(/\/$/, "") ?? "https://thapar-nexus.vercel.app";
const clientId = process.env.GOOGLE_CLIENT_ID ?? "(GOOGLE_CLIENT_ID not set)";

const origins = [local, prod];
const redirects = origins.map((o) => `${o}/api/auth/google/callback`);

console.log("\nGoogle Cloud Console → APIs & Services → Credentials");
console.log(`→ OAuth 2.0 Client ID: ${clientId}\n`);
console.log("Authorized JavaScript origins (add each):");
for (const o of origins) console.log(`  • ${o}`);
console.log("\nAuthorized redirect URIs (add each, byte-for-byte):");
for (const r of redirects) console.log(`  • ${r}`);
console.log("\nSave, wait ~1 minute, then retry Sign in with Google.\n");
