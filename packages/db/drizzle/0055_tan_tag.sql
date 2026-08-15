CREATE TABLE "user_calendar_token" (
	"user_id" text PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_calendar_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "user_calendar_token" ADD CONSTRAINT "user_calendar_token_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;