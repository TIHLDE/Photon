CREATE TABLE "org_group_law" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"paragraph" numeric(4, 2) NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amount" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_group_law" ADD CONSTRAINT "org_group_law_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;