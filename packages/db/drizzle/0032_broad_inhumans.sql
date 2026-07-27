CREATE TABLE "gallery_album" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text,
	"image_url" text,
	"image_alt" varchar(200),
	"event_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_album_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gallery_picture" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"source_url" text,
	"image_alt" varchar(200),
	"title" varchar(100),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gallery_album" ADD CONSTRAINT "gallery_album_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_album" ADD CONSTRAINT "gallery_album_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_picture" ADD CONSTRAINT "gallery_picture_album_id_gallery_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."gallery_album"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gallery_picture_album_id_idx" ON "gallery_picture" USING btree ("album_id");