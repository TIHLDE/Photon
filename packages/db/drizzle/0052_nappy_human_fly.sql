DROP INDEX "notification_user_id_created_at_idx";--> statement-breakpoint
CREATE INDEX "payment_event_id_user_id_idx" ON "event_payment" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "reaction_event_id_idx" ON "event_reaction" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "answer_option_answer_id_idx" ON "form_answer_option" USING btree ("answer_id");--> statement-breakpoint
CREATE INDEX "fine_group_slug_user_id_idx" ON "org_fine" USING btree ("group_slug","user_id");--> statement-breakpoint
CREATE INDEX "group_membership_group_slug_idx" ON "org_group_membership" USING btree ("group_slug");--> statement-breakpoint
CREATE INDEX "notification_user_id_created_at_idx" ON "notification_notification" USING btree ("user_id","created_at" DESC NULLS FIRST);