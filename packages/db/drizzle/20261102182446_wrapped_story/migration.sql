CREATE TABLE "wrapped_photo_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"photo_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wrapped_photo_comment_body_length" CHECK (char_length("body") between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "wrapped_photo_like" (
	"photo_id" uuid,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wrapped_photo_like_pkey" PRIMARY KEY("photo_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "wrapped_camera" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "wrapped_camera" ADD COLUMN "first_published_at" timestamp;--> statement-breakpoint
ALTER TABLE "wrapped_camera" ADD COLUMN "story_layout" text DEFAULT 'feed' NOT NULL;--> statement-breakpoint
CREATE INDEX "wrapped_photo_comment_photo_id_created_at_idx" ON "wrapped_photo_comment" ("photo_id","created_at");--> statement-breakpoint
ALTER TABLE "wrapped_photo_comment" ADD CONSTRAINT "wrapped_photo_comment_photo_id_wrapped_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "wrapped_photo"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wrapped_photo_comment" ADD CONSTRAINT "wrapped_photo_comment_user_id_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wrapped_photo_like" ADD CONSTRAINT "wrapped_photo_like_photo_id_wrapped_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "wrapped_photo"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wrapped_photo_like" ADD CONSTRAINT "wrapped_photo_like_user_id_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wrapped_camera" ADD CONSTRAINT "wrapped_camera_story_layout_valid" CHECK ("story_layout" in ('feed', 'cards'));