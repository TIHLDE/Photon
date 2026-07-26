CREATE TYPE "public"."application_attachment_kind" AS ENUM('receipt', 'budget', 'attachment');--> statement-breakpoint
CREATE TYPE "public"."application_budget_type" AS ENUM('social_budget', 'group_budget', 'approved_hs_application', 'approved_idkom_application');--> statement-breakpoint
CREATE TYPE "public"."application_case_type" AS ENUM('discussion', 'decision', 'orientation');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('new', 'in_progress', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."application_type" AS ENUM('expense', 'support', 'sports_support', 'hs_case');--> statement-breakpoint
CREATE TABLE "application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "application_type" NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"submitted_by_id" text,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"signature" text NOT NULL,
	"pdf_asset_key" text,
	"internal_comment" text,
	"handled_by_id" text,
	"handled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"asset_key" text NOT NULL,
	"kind" "application_attachment_kind" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_expense" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"cc_email" text,
	"amount_nok" integer NOT NULL,
	"expense_date" varchar(10) NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"budget_type" "application_budget_type" NOT NULL,
	"description" text NOT NULL,
	"account_number" varchar(13) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_hs_case" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"case_name" text NOT NULL,
	"case_type" "application_case_type" NOT NULL,
	"background" text NOT NULL,
	"assessment" text NOT NULL,
	"recommendation" text
);
--> statement-breakpoint
CREATE TABLE "application_support" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"purpose" text NOT NULL,
	"event_description" text NOT NULL,
	"justification" text NOT NULL,
	"total_amount_nok" integer NOT NULL,
	"budget_link" text,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_submitted_by_id_auth_user_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_handled_by_id_auth_user_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_attachment" ADD CONSTRAINT "application_attachment_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_expense" ADD CONSTRAINT "application_expense_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_expense" ADD CONSTRAINT "application_expense_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_hs_case" ADD CONSTRAINT "application_hs_case_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_support" ADD CONSTRAINT "application_support_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_support" ADD CONSTRAINT "application_support_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_submitted_by_id_created_at_index" ON "application" USING btree ("submitted_by_id","created_at");--> statement-breakpoint
CREATE INDEX "application_type_status_created_at_index" ON "application" USING btree ("type","status","created_at");--> statement-breakpoint
CREATE INDEX "application_attachment_application_id_index" ON "application_attachment" USING btree ("application_id");