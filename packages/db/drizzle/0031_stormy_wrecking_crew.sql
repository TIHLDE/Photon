ALTER TYPE "public"."application_type" ADD VALUE 'company_contact';--> statement-breakpoint
CREATE TABLE "application_company_contact" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"event_types" text[] NOT NULL,
	"semesters" text[] NOT NULL,
	"comment" text
);
--> statement-breakpoint
ALTER TABLE "application_company_contact" ADD CONSTRAINT "application_company_contact_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;