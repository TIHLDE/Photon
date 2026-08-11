ALTER TABLE "org_group" DROP CONSTRAINT "org_group_role_id_rbac_role_id_fk";
--> statement-breakpoint
ALTER TABLE "org_group" DROP CONSTRAINT "org_group_leader_role_id_rbac_role_id_fk";
--> statement-breakpoint
ALTER TABLE "org_group" DROP COLUMN "role_id";--> statement-breakpoint
ALTER TABLE "org_group" DROP COLUMN "leader_role_id";--> statement-breakpoint
ALTER TABLE "org_group" DROP COLUMN "permission_mode";--> statement-breakpoint
DROP TYPE "public"."org_group_permission_mode";