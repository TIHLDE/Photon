ALTER TABLE "auth_user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "display_username" text;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth_verification" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "auth_user" ADD CONSTRAINT "auth_user_username_unique" UNIQUE("username");