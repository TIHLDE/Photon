CREATE TABLE "asset_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"original_filename" varchar(512) NOT NULL,
	"content_type" varchar(255),
	"size" bigint NOT NULL,
	"uploaded_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_file_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "asset_file" ADD CONSTRAINT "asset_file_uploaded_by_id_auth_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;