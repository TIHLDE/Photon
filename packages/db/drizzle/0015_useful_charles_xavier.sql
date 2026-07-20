CREATE TYPE "public"."asset_visibility" AS ENUM('public', 'private');--> statement-breakpoint
ALTER TABLE "asset_file" ADD COLUMN "visibility" "asset_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_contract" ADD COLUMN "signature_placement" jsonb;--> statement-breakpoint
ALTER TABLE "org_contract" ADD COLUMN "name_placement" jsonb;--> statement-breakpoint
-- Signatures recorded before this migration captured no signature image, name or
-- signed PDF — only that a click happened. Nothing can be back-filled into the
-- NOT NULL columns below, so those rows are dropped and the members re-sign.
-- Empty in local dev; review before running against an environment with data.
DELETE FROM "org_contract_signature";--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD COLUMN "signed_name" varchar(256) NOT NULL;--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD COLUMN "signed_pdf_key" varchar(600) NOT NULL;--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD COLUMN "signed_pdf_hash" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD COLUMN "signature_file_key" varchar(600) NOT NULL;--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD COLUMN "signer_ip" varchar(45);--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD COLUMN "signer_ua" text;