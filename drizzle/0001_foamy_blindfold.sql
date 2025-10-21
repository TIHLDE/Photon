DROP TABLE "rbac_permission" CASCADE;--> statement-breakpoint
DROP TABLE "rbac_role_permission" CASCADE;--> statement-breakpoint
ALTER TABLE "rbac_role" ADD COLUMN "permissions" text[];