ALTER TABLE "event_event" ADD COLUMN "can_cause_strikes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_event" ADD COLUMN "no_show_processed_at" timestamp;