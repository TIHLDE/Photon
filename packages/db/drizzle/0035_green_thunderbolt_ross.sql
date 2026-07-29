CREATE TABLE "org_institute" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"short_name" varchar(16) NOT NULL,
	"name" varchar(160) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_institute_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "event_event" ADD COLUMN "restricted_to_institute_id" integer;--> statement-breakpoint
ALTER TABLE "org_group" ADD COLUMN "institute_id" integer;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_restricted_to_institute_id_org_institute_id_fk" FOREIGN KEY ("restricted_to_institute_id") REFERENCES "public"."org_institute"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group" ADD CONSTRAINT "org_group_institute_id_org_institute_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."org_institute"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "org_institute" ("slug", "short_name", "name") VALUES
	('idi', 'IDI', 'Institutt for datateknologi og informatikk'),
	('iik', 'IIK', 'Institutt for informasjonssikkerhet og kommunikasjonsteknologi')
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
UPDATE "org_group" SET "institute_id" = (SELECT "id" FROM "org_institute" WHERE "slug" = 'iik')
WHERE "slug" = 'digital-infrastruktur-og-cybersikkerhet';--> statement-breakpoint
UPDATE "org_group" SET "institute_id" = (SELECT "id" FROM "org_institute" WHERE "slug" = 'idi')
WHERE "slug" IN (
	'dataingenir',
	'digital-forretningsutvikling',
	'digital-samhandling',
	'drift-studie',
	'informasjonsbehandling'
);