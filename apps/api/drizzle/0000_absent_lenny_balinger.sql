CREATE TYPE "public"."event_payment_status" AS ENUM('pending', 'paid', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."event_registration_status" AS ENUM('registered', 'waitlisted', 'cancelled', 'attended', 'no_show', 'pending');--> statement-breakpoint
CREATE TYPE "public"."org_group_membership_role" AS ENUM('member', 'leader');--> statement-breakpoint
CREATE TYPE "public"."org_group_type" AS ENUM('studyyear', 'interestgroup', 'committee', 'study', 'private', 'board', 'subgroup', 'tihlde');--> statement-breakpoint
CREATE TYPE "public"."org_study_program_type" AS ENUM('bachelor', 'master');--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"legacy_token" text,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"description" text,
	"category_slug" varchar(64) NOT NULL,
	"location" varchar(256),
	"image_url" text,
	"capacity" integer,
	"allow_waitlist" boolean DEFAULT true NOT NULL,
	"contact_person_id" text,
	"created_by_user_id" text,
	"update_by_user_id" text,
	"start" timestamp NOT NULL,
	"end" timestamp NOT NULL,
	"registration_start" timestamp,
	"registration_end" timestamp,
	"cancellation_deadline" timestamp,
	"is_registration_closed" boolean DEFAULT false NOT NULL,
	"is_paid_event" boolean DEFAULT false NOT NULL,
	"requires_signing_up" boolean DEFAULT false NOT NULL,
	"price" integer,
	"payment_grace_period_minutes" integer,
	"reactions_allowed" boolean DEFAULT true NOT NULL,
	"organizer_group_slug" varchar(128),
	"enforces_previous_strikes" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_event_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_category" (
	"slug" varchar(64) PRIMARY KEY NOT NULL,
	"label" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_favorite" (
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_favorite_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text,
	"rating" integer,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"provider" varchar(64),
	"provider_payment_id" text,
	"status" "event_payment_status" DEFAULT 'pending' NOT NULL,
	"received_payment_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_priority_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"priority_score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_priority_pool_group" (
	"priority_pool_id" uuid NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_priority_pool_group_priority_pool_id_group_slug_pk" PRIMARY KEY("priority_pool_id","group_slug")
);
--> statement-breakpoint
CREATE TABLE "event_reaction" (
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"emoji" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_reaction_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_registration" (
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "event_registration_status" DEFAULT 'registered' NOT NULL,
	"waitlist_position" integer,
	"attended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_registration_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_strike" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"count" integer NOT NULL,
	"reason" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_group" (
	"image_url" varchar(600),
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) PRIMARY KEY NOT NULL,
	"description" text,
	"contact_email" varchar(200),
	"type" varchar(50) NOT NULL,
	"fine_info" text NOT NULL,
	"fines_activated" boolean NOT NULL,
	"fines_admin_id" varchar(15),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_group_membership" (
	"user_id" varchar(255) NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"role" "org_group_membership_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_group_membership_user_id_group_slug_pk" PRIMARY KEY("user_id","group_slug")
);
--> statement-breakpoint
CREATE TABLE "org_study_program" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"feide_code" varchar(32) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"type" "org_study_program_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_study_program_slug_unique" UNIQUE("slug"),
	CONSTRAINT "org_study_program_feide_code_unique" UNIQUE("feide_code")
);
--> statement-breakpoint
CREATE TABLE "org_study_program_membership" (
	"user_id" varchar(255) NOT NULL,
	"study_program_id" serial NOT NULL,
	"start_year" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_study_program_membership_user_id_study_program_id_pk" PRIMARY KEY("user_id","study_program_id")
);
--> statement-breakpoint
CREATE TABLE "rbac_permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_permission_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rbac_role" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(256),
	"position" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rbac_role_permission" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "rbac_user_role" (
	"user_id" text NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_category_slug_event_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."event_category"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_contact_person_id_auth_user_id_fk" FOREIGN KEY ("contact_person_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_update_by_user_id_auth_user_id_fk" FOREIGN KEY ("update_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_organizer_group_slug_org_group_slug_fk" FOREIGN KEY ("organizer_group_slug") REFERENCES "public"."org_group"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_favorite" ADD CONSTRAINT "event_favorite_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_favorite" ADD CONSTRAINT "event_favorite_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payment" ADD CONSTRAINT "event_payment_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payment" ADD CONSTRAINT "event_payment_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_priority_pool" ADD CONSTRAINT "event_priority_pool_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_priority_pool_group" ADD CONSTRAINT "event_priority_pool_group_priority_pool_id_event_priority_pool_id_fk" FOREIGN KEY ("priority_pool_id") REFERENCES "public"."event_priority_pool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_priority_pool_group" ADD CONSTRAINT "event_priority_pool_group_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reaction" ADD CONSTRAINT "event_reaction_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reaction" ADD CONSTRAINT "event_reaction_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_strike" ADD CONSTRAINT "event_strike_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_strike" ADD CONSTRAINT "event_strike_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group" ADD CONSTRAINT "org_group_fines_admin_id_auth_user_id_fk" FOREIGN KEY ("fines_admin_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group_membership" ADD CONSTRAINT "org_group_membership_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_group_membership" ADD CONSTRAINT "org_group_membership_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "public"."org_group"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_study_program_membership" ADD CONSTRAINT "org_study_program_membership_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_study_program_membership" ADD CONSTRAINT "org_study_program_membership_study_program_id_org_study_program_id_fk" FOREIGN KEY ("study_program_id") REFERENCES "public"."org_study_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permission" ADD CONSTRAINT "rbac_role_permission_role_id_rbac_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permission" ADD CONSTRAINT "rbac_role_permission_permission_id_rbac_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."rbac_permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_role" ADD CONSTRAINT "rbac_user_role_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_role" ADD CONSTRAINT "rbac_user_role_role_id_rbac_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_role"("id") ON DELETE cascade ON UPDATE no action;