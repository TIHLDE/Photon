CREATE TYPE "public"."job_type" AS ENUM('full_time', 'part_time', 'summer_job', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_class" AS ENUM('first', 'second', 'third', 'fourth', 'fifth', 'alumni');--> statement-breakpoint
CREATE TABLE "news_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"header" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"image_alt" varchar(255),
	"created_by_user_id" text,
	"emojis_allowed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_reaction" (
	"user_id" text NOT NULL,
	"news_id" uuid NOT NULL,
	"emoji" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_reaction_user_id_news_id_pk" PRIMARY KEY("user_id","news_id")
);
--> statement-breakpoint
CREATE TABLE "job_job_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"ingress" varchar(800) DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"company" varchar(200) NOT NULL,
	"location" varchar(200) NOT NULL,
	"deadline" timestamp,
	"is_continuously_hiring" boolean DEFAULT false NOT NULL,
	"job_type" "job_type" DEFAULT 'other' NOT NULL,
	"email" varchar(320),
	"link" text,
	"class_start" "user_class" DEFAULT 'first' NOT NULL,
	"class_end" "user_class" DEFAULT 'fifth' NOT NULL,
	"image_url" text,
	"image_alt" varchar(255),
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "news_news" ADD CONSTRAINT "news_news_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_reaction" ADD CONSTRAINT "news_reaction_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_reaction" ADD CONSTRAINT "news_reaction_news_id_news_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news_news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_job_post" ADD CONSTRAINT "job_job_post_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;