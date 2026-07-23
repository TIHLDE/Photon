DROP INDEX "org_group_position_slug_name";--> statement-breakpoint
ALTER TABLE "org_group_position_holder" DROP CONSTRAINT "org_group_position_holder_position_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "org_group_position_holder" ADD PRIMARY KEY ("position_id");