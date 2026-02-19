CREATE TYPE "public"."org_fine_status" AS ENUM('pending', 'approved', 'paid', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."org_group_permission_mode" AS ENUM('leader_only', 'member', 'custom');--> statement-breakpoint
CREATE TABLE "org_fine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"reason" text NOT NULL,
	"amount" integer NOT NULL,
	"defense" text,
	"status" "org_fine_status" DEFAULT 'pending' NOT NULL,
	"created_by_user_id" varchar(255),
	"approved_by_user_id" varchar(255),
	"approved_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_user_permission" (
	"user_id" text NOT NULL,
	"permission" varchar(64) NOT NULL,
	"scope" varchar(128),
	"granted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_user_permission_user_id_permission_scope_pk" PRIMARY KEY("user_id","permission","scope")
);
--> statement-breakpoint
ALTER TABLE "org_group" ALTER COLUMN "fines_admin_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "org_group" ADD COLUMN "role_id" integer;--> statement-breakpoint
ALTER TABLE "org_group" ADD COLUMN "permission_mode" "org_group_permission_mode" DEFAULT 'leader_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_fine" ADD CONSTRAINT "org_fine_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_fine" ADD CONSTRAINT "org_fine_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_fine" ADD CONSTRAINT "org_fine_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_fine" ADD CONSTRAINT "org_fine_approved_by_user_id_auth_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_permission" ADD CONSTRAINT "rbac_user_permission_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_permission" ADD CONSTRAINT "rbac_user_permission_granted_by_auth_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group" ADD CONSTRAINT "org_group_role_id_rbac_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_role"("id") ON DELETE set null ON UPDATE no action;