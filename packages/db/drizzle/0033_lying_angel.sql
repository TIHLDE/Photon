-- Collapse duplicate (form_id, group_slug) rows before the constraint can
-- reject them. The Lepton import inserted group forms with a random id against
-- a conflict target of the primary key alone, so every run re-inserted the
-- whole set; prod reached three copies of all 28 rows. Prod is already cleaned
-- by hand, but a database that still carries duplicates would fail this
-- migration on boot — and the API's entrypoint runs `migrate && start`, so a
-- failure here means the service never comes up. Keeping the oldest row
-- preserves the original created_at.
DELETE FROM "form_group_form" t
USING "form_group_form" keep
WHERE t."form_id" = keep."form_id"
  AND t."group_slug" = keep."group_slug"
  AND (t."created_at", t."id") > (keep."created_at", keep."id");
--> statement-breakpoint
ALTER TABLE "form_group_form" ADD CONSTRAINT "unique_group_form" UNIQUE("form_id","group_slug");
