CREATE TYPE "public"."asset_status" AS ENUM('staged', 'ready');--> statement-breakpoint
ALTER TABLE "asset_file" ADD COLUMN "status" "asset_status" DEFAULT 'staged' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_file" ADD COLUMN "promoted_at" timestamp;