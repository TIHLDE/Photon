CREATE TABLE "event_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"sent_by_id" text,
	"title" varchar(80) NOT NULL,
	"body" text NOT NULL,
	"recipient_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_message" ADD CONSTRAINT "event_message_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_message" ADD CONSTRAINT "event_message_sent_by_id_auth_user_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_event_id_idx" ON "event_message" USING btree ("event_id");