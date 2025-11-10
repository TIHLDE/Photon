CREATE TYPE "public"."user_gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TABLE "user_allergy" (
	"slug" varchar(64) PRIMARY KEY NOT NULL,
	"label" varchar(128) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "user_user_setting_allergy" (
	"user_id" text NOT NULL,
	"allergy_slug" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_user_setting_allergy_user_id_allergy_slug_pk" PRIMARY KEY("user_id","allergy_slug")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"gender" "user_gender" NOT NULL,
	"allows_photos_by_default" boolean DEFAULT false NOT NULL,
	"accepts_event_rules" boolean NOT NULL,
	"image_url" text,
	"bio_description" text,
	"github_url" varchar(256),
	"linkedin_url" varchar(256),
	"receive_mail_communication" boolean NOT NULL,
	"is_onboarded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_user_setting_allergy" ADD CONSTRAINT "user_user_setting_allergy_user_id_user_settings_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_settings"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_user_setting_allergy" ADD CONSTRAINT "user_user_setting_allergy_allergy_slug_user_allergy_slug_fk" FOREIGN KEY ("allergy_slug") REFERENCES "public"."user_allergy"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;