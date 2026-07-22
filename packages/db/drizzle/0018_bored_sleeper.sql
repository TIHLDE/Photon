ALTER TABLE "event_event" ADD COLUMN "image_alt" varchar(255);--> statement-breakpoint
ALTER TABLE "event_event" ADD COLUMN "only_allow_prioritized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registration" ADD COLUMN "allow_photo" boolean DEFAULT true NOT NULL;