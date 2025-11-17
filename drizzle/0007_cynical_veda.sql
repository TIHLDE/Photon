CREATE TABLE "apikey_api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"created_by_user_id" text,
	"last_used_at" timestamp,
	"permissions" text NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apikey_api_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "apikey_api_key" ADD CONSTRAINT "apikey_api_key_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;