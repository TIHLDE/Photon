CREATE TABLE "org_group_membership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_group_membership_history" ADD CONSTRAINT "org_group_membership_history_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group_membership_history" ADD CONSTRAINT "org_group_membership_history_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_membership_history_group_slug_idx" ON "org_group_membership_history" USING btree ("group_slug");--> statement-breakpoint
CREATE INDEX "group_membership_history_user_id_idx" ON "org_group_membership_history" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_membership_history_stint_idx" ON "org_group_membership_history" USING btree ("user_id","group_slug","ended_at");