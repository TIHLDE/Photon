DROP INDEX "org_group_position_slug_name";--> statement-breakpoint
ALTER TABLE "org_group_position_holder" DROP CONSTRAINT "org_group_position_holder_position_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "org_group_position_holder" ADD PRIMARY KEY ("position_id");--> statement-breakpoint
ALTER TABLE "org_group_position" ADD COLUMN "linked_group_slug" varchar(128);--> statement-breakpoint
ALTER TABLE "org_group_position" ADD CONSTRAINT "org_group_position_linked_group_slug_org_group_slug_fk" FOREIGN KEY ("linked_group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;