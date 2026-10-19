ALTER TABLE "wrapped_photo" ADD COLUMN "source" text DEFAULT 'camera' NOT NULL;--> statement-breakpoint
ALTER TABLE "wrapped_photo" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "wrapped_photo" ADD CONSTRAINT "wrapped_photo_source_valid" CHECK ("wrapped_photo"."source" in ('camera', 'camera_roll'));--> statement-breakpoint
-- Photos taken before drafts existed were already visible to the organizer.
-- They stay that way: submitted when they were taken.
UPDATE "wrapped_photo" SET "submitted_at" = "created_at";