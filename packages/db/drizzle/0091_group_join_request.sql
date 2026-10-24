CREATE TABLE "org_group_join_request" (
	"user_id" varchar(255) NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_group_join_request_user_id_group_slug_pk" PRIMARY KEY("user_id","group_slug")
);
--> statement-breakpoint
ALTER TABLE "org_group_join_request" ADD CONSTRAINT "org_group_join_request_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group_join_request" ADD CONSTRAINT "org_group_join_request_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_join_request_group_slug_idx" ON "org_group_join_request" USING btree ("group_slug");