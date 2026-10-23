ALTER TABLE "application_company_contact" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "application_company_contact" ADD COLUMN "company_type" text;--> statement-breakpoint
ALTER TABLE "application_company_contact" ADD COLUMN "has_trondheim_office" boolean;--> statement-breakpoint
ALTER TABLE "application_company_contact" ADD COLUMN "about" text;--> statement-breakpoint
ALTER TABLE "application_company_contact" ADD COLUMN "themes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_company_contact" ADD COLUMN "class_levels" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_company_contact" ADD COLUMN "participants" text;--> statement-breakpoint
ALTER TABLE "application_company_contact" ADD COLUMN "extras" text[] DEFAULT '{}' NOT NULL;