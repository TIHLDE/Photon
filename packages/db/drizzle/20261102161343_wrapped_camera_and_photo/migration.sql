CREATE TABLE "wrapped_camera" (
	"event_id" uuid PRIMARY KEY,
	"enabled" boolean DEFAULT false NOT NULL,
	"shots_per_person" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wrapped_camera_shots_per_person_positive" CHECK ("shots_per_person" > 0)
);
--> statement-breakpoint
CREATE TABLE "wrapped_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"asset_key" text NOT NULL UNIQUE,
	"source" text DEFAULT 'camera' NOT NULL,
	"submitted_at" timestamp,
	"selected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wrapped_photo_source_valid" CHECK ("source" in ('camera', 'camera_roll'))
);
--> statement-breakpoint
CREATE INDEX "wrapped_photo_event_id_uploaded_by_id_idx" ON "wrapped_photo" ("event_id","uploaded_by_id");--> statement-breakpoint
ALTER TABLE "wrapped_camera" ADD CONSTRAINT "wrapped_camera_event_id_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wrapped_photo" ADD CONSTRAINT "wrapped_photo_event_id_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wrapped_photo" ADD CONSTRAINT "wrapped_photo_uploaded_by_id_auth_user_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;