# Admins, one super admin, and a separate admin door

Governance outgrew a single ADMIN account. There are now many `ADMIN`s and exactly one `SUPER_ADMIN`, a Postgres enum value guarded by the partial unique index `one_super_admin`. The existing admin was promoted by migration, and `bootstrap:admin` now creates the super admin. The super admin alone holds `user:manage_admins`, `user:suspend`, `faculty_allowlist:manage` and `opportunity:remove`. Every other admin permission is shared.

Admin accounts sign in only at `/admin` (email + password or an emailed code, no Google), and the member sign-in at `/` refuses them. The check runs after the credential check, so it reveals nothing to someone without the password. Keeping the doors apart keeps governance accounts, often off the institute domain, out of the member flow. A new admin gets no password: they are emailed a pointer to `/admin` and use a one-time code, so no secret travels by email.

Removing an admin soft-deletes the account and revokes every session. Re-adding the same email restores that row, because emails are unique.

Status: accepted. Supersedes the "single Admin" assumption in CONTEXT.md.
