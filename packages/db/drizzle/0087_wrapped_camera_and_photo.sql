CREATE TABLE "wrapped_camera" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"shots_per_person" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wrapped_camera_shots_per_person_positive" CHECK ("wrapped_camera"."shots_per_person" > 0)
);
--> statement-breakpoint
CREATE TABLE "wrapped_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"asset_key" text NOT NULL,
	"selected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wrapped_photo_asset_key_unique" UNIQUE("asset_key")
);
--> statement-breakpoint
ALTER TABLE "wrapped_camera" ADD CONSTRAINT "wrapped_camera_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapped_photo" ADD CONSTRAINT "wrapped_photo_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapped_photo" ADD CONSTRAINT "wrapped_photo_uploaded_by_id_auth_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wrapped_photo_event_id_uploaded_by_id_idx" ON "wrapped_photo" USING btree ("event_id","uploaded_by_id");