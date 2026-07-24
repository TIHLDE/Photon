CREATE TYPE "public"."event_visibility" AS ENUM('public', 'members');--> statement-breakpoint
ALTER TABLE "event_event" ADD COLUMN "visibility" "event_visibility" DEFAULT 'public' NOT NULL;