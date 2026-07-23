CREATE TYPE "public"."org_group_position_scope" AS ENUM('group', 'global');--> statement-breakpoint
CREATE TABLE "org_group_position" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"scope" "org_group_position_scope" DEFAULT 'group' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_group_position_holder" (
	"position_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"granted_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_group_position_holder_position_id_user_id_pk" PRIMARY KEY("position_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "org_group" ADD COLUMN "leader_role_id" integer;--> statement-breakpoint
ALTER TABLE "org_group_position" ADD CONSTRAINT "org_group_position_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group_position_holder" ADD CONSTRAINT "org_group_position_holder_position_id_org_group_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."org_group_position"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group_position_holder" ADD CONSTRAINT "org_group_position_holder_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group_position_holder" ADD CONSTRAINT "org_group_position_holder_granted_by_auth_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_group_position_slug_name" ON "org_group_position" USING btree ("group_slug","name");--> statement-breakpoint
ALTER TABLE "org_group" ADD CONSTRAINT "org_group_leader_role_id_rbac_role_id_fk" FOREIGN KEY ("leader_role_id") REFERENCES "public"."rbac_role"("id") ON DELETE set null ON UPDATE no action;