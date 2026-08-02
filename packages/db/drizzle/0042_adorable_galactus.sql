CREATE TYPE "public"."motetid_date_mode" AS ENUM('DATES', 'WEEKDAYS');--> statement-breakpoint
ALTER TABLE "motetid_event" ADD COLUMN "date_mode" "motetid_date_mode" DEFAULT 'DATES' NOT NULL;