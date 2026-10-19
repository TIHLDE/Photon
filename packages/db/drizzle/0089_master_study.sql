CREATE TYPE "public"."master_study_location_type" AS ENUM('innland', 'utland');--> statement-breakpoint
CREATE TABLE "master_study_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_program_id" integer NOT NULL,
	"name" varchar(300) NOT NULL,
	"location" varchar(300) NOT NULL,
	"location_type" "master_study_location_type" NOT NULL,
	"link" varchar(500) NOT NULL,
	"has_financial_support" boolean DEFAULT false NOT NULL,
	"financial_support" text,
	"subject_requirements" text,
	"other_requirements" text,
	"summary" text,
	"application_deadline" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_study_entry_financial_support_check" CHECK ("master_study_entry"."has_financial_support" OR "master_study_entry"."financial_support" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "master_study_quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"name" varchar(200),
	"quote" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "master_study_entry" ADD CONSTRAINT "master_study_entry_study_program_id_org_study_program_id_fk" FOREIGN KEY ("study_program_id") REFERENCES "public"."org_study_program"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_study_entry" ADD CONSTRAINT "master_study_entry_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_study_quote" ADD CONSTRAINT "master_study_quote_entry_id_master_study_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."master_study_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "master_study_entry_study_program_id_idx" ON "master_study_entry" USING btree ("study_program_id");--> statement-breakpoint
CREATE INDEX "master_study_entry_updated_at_idx" ON "master_study_entry" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "master_study_quote_entry_id_idx" ON "master_study_quote" USING btree ("entry_id");