CREATE TYPE "public"."motetid_slot_status" AS ENUM('AVAILABLE', 'IF_NEEDED');--> statement-breakpoint
CREATE TABLE "motetid_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(12) NOT NULL,
	"title" text NOT NULL,
	"created_by_id" text,
	"dates" text[] NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"slot_duration" integer DEFAULT 30 NOT NULL,
	"deadline" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "motetid_event_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "motetid_google_credential" (
	"user_id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "motetid_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "motetid_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"date" varchar(10) NOT NULL,
	"time" varchar(5) NOT NULL,
	"status" "motetid_slot_status" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "motetid_event" ADD CONSTRAINT "motetid_event_created_by_id_auth_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motetid_google_credential" ADD CONSTRAINT "motetid_google_credential_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motetid_participant" ADD CONSTRAINT "motetid_participant_event_id_motetid_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."motetid_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motetid_participant" ADD CONSTRAINT "motetid_participant_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motetid_slot" ADD CONSTRAINT "motetid_slot_participant_id_motetid_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."motetid_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motetid_slot" ADD CONSTRAINT "motetid_slot_event_id_motetid_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."motetid_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "motetid_event_created_by_id_index" ON "motetid_event" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "motetid_participant_event_id_user_id_index" ON "motetid_participant" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "motetid_participant_user_id_index" ON "motetid_participant" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "motetid_slot_participant_id_date_time_index" ON "motetid_slot" USING btree ("participant_id","date","time");--> statement-breakpoint
CREATE INDEX "motetid_slot_event_id_date_time_index" ON "motetid_slot" USING btree ("event_id","date","time");