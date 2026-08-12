CREATE TYPE "public"."feedback_status" AS ENUM('open', 'in_progress', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('idea', 'bug');--> statement-breakpoint
CREATE TYPE "public"."feedback_vote_value" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TABLE "feedback_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "feedback_type" NOT NULL,
	"status" "feedback_status" DEFAULT 'open' NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"author_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_vote" (
	"feedback_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"value" "feedback_vote_value" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_vote_feedback_id_user_id_pk" PRIMARY KEY("feedback_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "feedback_item" ADD CONSTRAINT "feedback_item_author_id_auth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_vote" ADD CONSTRAINT "feedback_vote_feedback_id_feedback_item_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_vote" ADD CONSTRAINT "feedback_vote_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_item_created_at_idx" ON "feedback_item" USING btree ("created_at");