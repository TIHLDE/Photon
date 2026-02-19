CREATE TYPE "public"."form_event_form_type" AS ENUM('survey', 'evaluation');--> statement-breakpoint
CREATE TYPE "public"."form_field_type" AS ENUM('text_answer', 'multiple_select', 'single_select');--> statement-breakpoint
CREATE TABLE "form_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(400) NOT NULL,
	"description" text,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"field_id" uuid,
	"answer_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_answer_option" (
	"answer_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_event_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"type" "form_event_form_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_event_type" UNIQUE("event_id","type")
);
--> statement-breakpoint
CREATE TABLE "form_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"title" varchar(400) NOT NULL,
	"type" "form_field_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_group_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"email_receiver_on_submit" varchar(256),
	"can_submit_multiple" boolean DEFAULT true NOT NULL,
	"is_open_for_submissions" boolean DEFAULT false NOT NULL,
	"only_for_group_members" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"title" varchar(400) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_answer" ADD CONSTRAINT "form_answer_submission_id_form_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answer" ADD CONSTRAINT "form_answer_field_id_form_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."form_field"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answer_option" ADD CONSTRAINT "form_answer_option_answer_id_form_answer_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."form_answer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answer_option" ADD CONSTRAINT "form_answer_option_option_id_form_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."form_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_event_form" ADD CONSTRAINT "form_event_form_form_id_form_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_event_form" ADD CONSTRAINT "form_event_form_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_field" ADD CONSTRAINT "form_field_form_id_form_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_group_form" ADD CONSTRAINT "form_group_form_form_id_form_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_group_form" ADD CONSTRAINT "form_group_form_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_option" ADD CONSTRAINT "form_option_field_id_form_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."form_field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_form_id_form_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;