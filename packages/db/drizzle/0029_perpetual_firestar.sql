CREATE TYPE "public"."org_campus" AS ENUM('trondheim', 'gjovik', 'alesund');--> statement-breakpoint
ALTER TABLE "org_study_program_membership" ADD COLUMN "confirmed_campus" "org_campus";