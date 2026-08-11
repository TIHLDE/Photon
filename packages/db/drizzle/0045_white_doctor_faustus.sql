ALTER TABLE "auth_user" ADD COLUMN "approval_status" text;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "approved_by" text;--> statement-breakpoint
CREATE INDEX "user_approvalStatus_idx" ON "auth_user" USING btree ("approval_status");