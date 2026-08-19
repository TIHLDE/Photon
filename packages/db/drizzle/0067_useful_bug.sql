ALTER TABLE "org_study_program_membership" ALTER COLUMN "start_year_source" SET DATA TYPE text;--> statement-breakpoint
--
-- `assumed` becomes `derived`. Must run while the column is still text: the
-- cast back at the bottom rejects any value the new enum does not list, so
-- without this the migration fails outright on the 64 rows holding it.
--
-- The two are the same claim about the same rows — "a year we worked out
-- ourselves, which anything better may overwrite" — so this is a rename, not a
-- reinterpretation.
--
UPDATE "org_study_program_membership" SET "start_year_source" = 'derived' WHERE "start_year_source" = 'assumed';--> statement-breakpoint
DROP TYPE "public"."org_study_year_source";--> statement-breakpoint
CREATE TYPE "public"."org_study_year_source" AS ENUM('feide', 'derived', 'manual', 'migrated');--> statement-breakpoint
ALTER TABLE "org_study_program_membership" ALTER COLUMN "start_year_source" SET DATA TYPE "public"."org_study_year_source" USING "start_year_source"::"public"."org_study_year_source";
