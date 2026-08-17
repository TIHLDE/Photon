ALTER TABLE "auth_account" ADD COLUMN "password_source" text;--> statement-breakpoint
-- Mark the placeholder passwords the Lepton migration created on 2026-07-22.
--
-- `import-users.ts` gave every migrated member `crypto.randomUUID()` as their
-- password and stored it nowhere, so the row proves nothing about the member
-- being able to sign in. Measured against production 2026-08-15: 1639 rows
-- were created that day and only 5 have ever been updated since, so an
-- untouched `updated_at` separates the placeholders cleanly from the handful
-- of members who have since reset their password for real.
--
-- Nothing is deleted. A real password reset overwrites the hash and clears
-- this marker in the same statement (see `onPasswordReset`), so a placeholder
-- stops being one the moment its owner chooses a password they know.
UPDATE "auth_account"
SET "password_source" = 'migrated'
WHERE "provider_id" = 'credential'
  AND "password" IS NOT NULL
  AND "created_at"::date = DATE '2026-07-22'
  AND "updated_at" <= "created_at" + INTERVAL '1 minute';
