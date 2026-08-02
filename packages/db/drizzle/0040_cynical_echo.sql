CREATE TYPE "public"."org_study_year_source" AS ENUM('feide', 'assumed', 'manual', 'migrated');--> statement-breakpoint
ALTER TABLE "org_study_program_membership" ADD COLUMN "start_year_source" "org_study_year_source";--> statement-breakpoint
-- Backfill: every year already in the table came from a Feide login, because
-- syncFeideForUser is the only writer that has ever existed for it.
UPDATE "org_study_program_membership"
SET "start_year_source" = 'feide'
WHERE "start_year" IS NOT NULL
  AND "start_year_source" IS NULL;--> statement-breakpoint
-- Backfill: rows with no year, where the cohort group Lepton migrated in still
-- knows it. Affects the ITBAITBEDR members, whom Feide never gives a
-- `fc:fs:kull` group for, so their year only survives in the group projection.
--
-- `substring(... from '^[0-9]{4}$')` rather than a bare cast: it yields NULL on
-- anything non-numeric instead of aborting the whole migration, so a stray
-- cohort group name can never take the deploy down.
UPDATE "org_study_program_membership" m
SET "start_year" = c."year",
    "start_year_source" = 'migrated'
FROM (
    SELECT gm."user_id",
           max(substring(g."name" from '^[0-9]{4}$')::int) AS "year"
    FROM "org_group_membership" gm
    JOIN "org_group" g ON g."slug" = gm."group_slug"
    WHERE upper(g."type") = 'STUDYYEAR'
    GROUP BY gm."user_id"
) c
WHERE m."user_id" = c."user_id"
  AND m."start_year" IS NULL
  AND c."year" IS NOT NULL;