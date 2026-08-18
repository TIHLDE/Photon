CREATE TYPE "public"."event_payment_flag" AS ENUM('provider_unreachable', 'paid_without_spot');--> statement-breakpoint
ALTER TABLE "event_event" ALTER COLUMN "payment_grace_period_minutes" SET DEFAULT 120;--> statement-breakpoint
ALTER TABLE "event_event" ADD COLUMN "payment_review_notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_payment" ADD COLUMN "deadline_extended_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_payment" ADD COLUMN "flag" "event_payment_flag";--> statement-breakpoint
ALTER TABLE "event_payment" ADD COLUMN "flagged_at" timestamp;