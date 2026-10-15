CREATE TYPE "public"."org_group_join_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "org_group_join_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"name" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"status" "org_group_join_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_group" ADD COLUMN "accepts_join_requests" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "org_group_join_request" ADD CONSTRAINT "org_group_join_request_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group_join_request" ADD CONSTRAINT "org_group_join_request_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_join_request_one_pending_idx" ON "org_group_join_request" USING btree ("user_id","group_slug") WHERE "org_group_join_request"."status" = 'pending';