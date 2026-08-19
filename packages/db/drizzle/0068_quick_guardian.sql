ALTER TABLE "org_group" ADD COLUMN "study_program_id" integer;--> statement-breakpoint
ALTER TABLE "org_group" ADD CONSTRAINT "org_group_study_program_id_org_study_program_id_fk" FOREIGN KEY ("study_program_id") REFERENCES "public"."org_study_program"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
--
-- Link the one group that exists today. Written as a lookup rather than a
-- literal id so it lands correctly whatever the sequence produced, and as a
-- no-op anywhere the group is absent — every environment but production.
--
UPDATE "org_group"
SET "study_program_id" = (SELECT "id" FROM "org_study_program" WHERE "slug" = 'digital-samhandling')
WHERE "slug" = 'digitaltransformasjonfaddergruppe'
  AND EXISTS (SELECT 1 FROM "org_study_program" WHERE "slug" = 'digital-samhandling');
