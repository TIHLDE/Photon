ALTER TABLE "org_group" ADD COLUMN "logo_url" varchar(600);--> statement-breakpoint
-- Every existing `image_url` came from Lepton's group logo (see
-- apps/api/src/db/import-group-logos.ts) and is rendered square/in a circle.
-- Move it to the new logo column and free `image_url` up for the wide
-- gruppebilde on the Om-page. No data is lost: the values live on in logo_url.
UPDATE "org_group" SET "logo_url" = "image_url" WHERE "image_url" IS NOT NULL;--> statement-breakpoint
UPDATE "org_group" SET "image_url" = NULL;
