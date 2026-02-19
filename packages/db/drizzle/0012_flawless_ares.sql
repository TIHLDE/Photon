ALTER TABLE "rbac_user_permission" ALTER COLUMN "scope" SET DEFAULT '*';--> statement-breakpoint
ALTER TABLE "rbac_user_permission" ALTER COLUMN "scope" SET NOT NULL;