CREATE TYPE "org_campus" AS ENUM('trondheim', 'gjovik', 'alesund');--> statement-breakpoint
CREATE TYPE "org_fine_status" AS ENUM('pending', 'approved', 'paid', 'rejected');--> statement-breakpoint
CREATE TYPE "org_group_membership_role" AS ENUM('member', 'leader');--> statement-breakpoint
CREATE TYPE "org_group_position_scope" AS ENUM('group', 'global');--> statement-breakpoint
CREATE TYPE "org_group_type" AS ENUM('studyyear', 'interestgroup', 'committee', 'study', 'private', 'board', 'subgroup', 'tihlde');--> statement-breakpoint
CREATE TYPE "org_study_program_type" AS ENUM('bachelor', 'master');--> statement-breakpoint
CREATE TYPE "org_study_year_source" AS ENUM('feide', 'derived', 'manual', 'migrated');--> statement-breakpoint
CREATE TYPE "event_visibility" AS ENUM('public', 'members');--> statement-breakpoint
CREATE TYPE "event_payment_flag" AS ENUM('provider_unreachable', 'paid_without_spot');--> statement-breakpoint
CREATE TYPE "event_payment_status" AS ENUM('pending', 'paid', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "event_registration_status" AS ENUM('registered', 'waitlisted', 'cancelled', 'attended', 'no_show', 'pending');--> statement-breakpoint
CREATE TYPE "form_event_form_type" AS ENUM('survey', 'evaluation');--> statement-breakpoint
CREATE TYPE "form_field_type" AS ENUM('text_answer', 'multiple_select', 'single_select');--> statement-breakpoint
CREATE TYPE "job_type" AS ENUM('full_time', 'part_time', 'summer_job', 'other');--> statement-breakpoint
CREATE TYPE "user_class" AS ENUM('first', 'second', 'third', 'fourth', 'fifth', 'alumni');--> statement-breakpoint
CREATE TYPE "user_gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "asset_status" AS ENUM('staged', 'ready');--> statement-breakpoint
CREATE TYPE "asset_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "application_attachment_kind" AS ENUM('receipt', 'budget', 'attachment');--> statement-breakpoint
CREATE TYPE "application_budget_type" AS ENUM('social_budget', 'group_budget', 'approved_hs_application', 'approved_idkom_application');--> statement-breakpoint
CREATE TYPE "application_case_type" AS ENUM('discussion', 'decision', 'orientation');--> statement-breakpoint
CREATE TYPE "application_status" AS ENUM('new', 'in_progress', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "application_type" AS ENUM('expense', 'support', 'sports_support', 'hs_case', 'company_contact');--> statement-breakpoint
CREATE TYPE "feedback_status" AS ENUM('open', 'in_progress', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "feedback_type" AS ENUM('idea', 'bug');--> statement-breakpoint
CREATE TYPE "feedback_vote_value" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY,
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
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"password_source" text
);
--> statement-breakpoint
CREATE TABLE "auth_jwks" (
	"id" text PRIMARY KEY,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_access_token" (
	"id" text PRIMARY KEY,
	"token" text NOT NULL CONSTRAINT "auth_oauth_access_token_token_unique" UNIQUE,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text,
	"reference_id" text,
	"refresh_id" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"scopes" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_client" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL CONSTRAINT "auth_oauth_client_client_id_unique" UNIQUE,
	"client_secret" text,
	"disabled" boolean DEFAULT false,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"subject_type" text,
	"scopes" text[],
	"user_id" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text[],
	"tos" text,
	"policy" text,
	"software_id" text,
	"software_version" text,
	"software_statement" text,
	"redirect_uris" text[] NOT NULL,
	"post_logout_redirect_uris" text[],
	"token_endpoint_auth_method" text,
	"grant_types" text[],
	"response_types" text[],
	"public" boolean,
	"type" text,
	"require_pkce" boolean,
	"reference_id" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_consent" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"user_id" text,
	"reference_id" text,
	"scopes" text[] NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_refresh_token" (
	"id" text PRIMARY KEY,
	"token" text NOT NULL CONSTRAINT "auth_oauth_refresh_token_token_unique" UNIQUE,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text NOT NULL,
	"reference_id" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"revoked" timestamp,
	"auth_time" timestamp,
	"scopes" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL CONSTRAINT "auth_session_token_unique" UNIQUE,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL CONSTRAINT "auth_user_email_unique" UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"username" text CONSTRAINT "auth_user_username_unique" UNIQUE,
	"display_username" text,
	"approval_status" text,
	"approved_at" timestamp,
	"approved_by" text
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(256) NOT NULL,
	"file_key" varchar(600) NOT NULL,
	"version" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_user_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"signature_placement" jsonb,
	"name_placement" jsonb
);
--> statement-breakpoint
CREATE TABLE "org_contract_signature" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"contract_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"signed_name" varchar(256) NOT NULL,
	"signed_pdf_key" varchar(600) NOT NULL,
	"signed_pdf_hash" varchar(64) NOT NULL,
	"signature_file_key" varchar(600) NOT NULL,
	"signer_ip" varchar(45),
	"signer_ua" text
);
--> statement-breakpoint
CREATE TABLE "org_fine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" varchar(255) NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"reason" text NOT NULL,
	"amount" integer NOT NULL,
	"defense" text,
	"status" "org_fine_status" DEFAULT 'pending'::"org_fine_status" NOT NULL,
	"created_by_user_id" varchar(255),
	"approved_by_user_id" varchar(255),
	"approved_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"image" varchar(600),
	"law_id" uuid
);
--> statement-breakpoint
CREATE TABLE "org_group" (
	"image_url" varchar(600),
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) PRIMARY KEY,
	"description" text,
	"contact_email" varchar(200),
	"type" varchar(50) NOT NULL,
	"fine_info" text NOT NULL,
	"fines_activated" boolean NOT NULL,
	"fines_admin_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"contract_signing_required" boolean DEFAULT false NOT NULL,
	"institute_id" integer,
	"logo_url" varchar(600),
	"subtype" varchar(50),
	"leader_permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"member_permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"member_global_permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"leader_title" varchar(128),
	"leader_global_permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"study_program_id" integer,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "org_group_join_request" (
	"user_id" varchar(255),
	"group_slug" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_group_join_request_user_id_group_slug_pk" PRIMARY KEY("user_id","group_slug")
);
--> statement-breakpoint
CREATE TABLE "org_group_law" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_slug" varchar(128) NOT NULL,
	"paragraph" numeric(4,2) NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amount" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_group_membership" (
	"user_id" varchar(255),
	"group_slug" varchar(128),
	"role" "org_group_membership_role" DEFAULT 'member'::"org_group_membership_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_group_membership_user_id_group_slug_pk" PRIMARY KEY("user_id","group_slug")
);
--> statement-breakpoint
CREATE TABLE "org_group_membership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" varchar(255) NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_group_position" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_slug" varchar(128) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope" "org_group_position_scope" DEFAULT 'group'::"org_group_position_scope" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"linked_group_slug" varchar(128),
	"global_permissions" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_group_position_holder" (
	"position_id" uuid,
	"user_id" varchar(255),
	"granted_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_group_position_holder_position_id_user_id_pk" PRIMARY KEY("position_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "org_institute" (
	"id" serial PRIMARY KEY,
	"slug" varchar(64) NOT NULL CONSTRAINT "org_institute_slug_unique" UNIQUE,
	"short_name" varchar(16) NOT NULL,
	"name" varchar(160) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_study_program" (
	"id" serial PRIMARY KEY,
	"slug" varchar(64) NOT NULL CONSTRAINT "org_study_program_slug_unique" UNIQUE,
	"feide_code" varchar(32) NOT NULL CONSTRAINT "org_study_program_feide_code_unique" UNIQUE,
	"display_name" varchar(128) NOT NULL,
	"type" "org_study_program_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_study_program_membership" (
	"user_id" varchar(255),
	"study_program_id" serial,
	"start_year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_campus" "org_campus",
	"start_year_source" "org_study_year_source",
	"feide_active" boolean,
	"feide_checked_at" timestamp,
	CONSTRAINT "org_study_program_membership_user_id_study_program_id_pk" PRIMARY KEY("user_id","study_program_id")
);
--> statement-breakpoint
CREATE TABLE "event_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL CONSTRAINT "event_event_slug_unique" UNIQUE,
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
	"reactions_allowed" boolean DEFAULT true NOT NULL,
	"organizer_group_slug" varchar(128),
	"enforces_previous_strikes" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"image_alt" varchar(255),
	"only_allow_prioritized" boolean DEFAULT false NOT NULL,
	"visibility" "event_visibility" DEFAULT 'public'::"event_visibility" NOT NULL,
	"can_cause_strikes" boolean DEFAULT false NOT NULL,
	"no_show_processed_at" timestamp,
	"location_lat" double precision,
	"location_lng" double precision,
	"restricted_to_institute_id" integer,
	"registration_reminder_sent_at" timestamp,
	"payment_review_notified_at" timestamp,
	"open_to_alumni" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_category" (
	"slug" varchar(64) PRIMARY KEY,
	"label" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_favorite" (
	"user_id" text,
	"event_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_favorite_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"user_id" text,
	"rating" integer,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"sent_by_id" text,
	"title" varchar(80) NOT NULL,
	"body" text NOT NULL,
	"recipient_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"provider" varchar(64),
	"provider_payment_id" text,
	"status" "event_payment_status" DEFAULT 'pending'::"event_payment_status" NOT NULL,
	"received_payment_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"deadline_extended_at" timestamp,
	"flag" "event_payment_flag",
	"flagged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "event_priority_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"group_slug" varchar(128),
	"class_year" smallint,
	CONSTRAINT "priority_pool_not_empty" CHECK ("group_slug" is not null or "class_year" is not null),
	CONSTRAINT "priority_pool_class_year_range" CHECK ("class_year" is null or "class_year" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "event_priority_pool_group" (
	"priority_pool_id" uuid,
	"group_slug" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_priority_pool_group_priority_pool_id_group_slug_pk" PRIMARY KEY("priority_pool_id","group_slug")
);
--> statement-breakpoint
CREATE TABLE "event_priority_user" (
	"event_id" uuid,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_priority_user_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "event_reaction" (
	"user_id" text,
	"event_id" uuid,
	"emoji" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_reaction_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_registration" (
	"event_id" uuid,
	"user_id" text,
	"status" "event_registration_status" DEFAULT 'registered'::"event_registration_status" NOT NULL,
	"waitlist_position" integer,
	"attended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"allow_photo" boolean DEFAULT true NOT NULL,
	"evaluation_reminder_sent_at" timestamp,
	"promoted_from_waitlist_at" timestamp,
	CONSTRAINT "event_registration_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_strike" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"count" integer NOT NULL,
	"reason" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_vipps_webhook" (
	"id" text PRIMARY KEY,
	"secret" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_role" (
	"id" serial PRIMARY KEY,
	"name" varchar(64) NOT NULL CONSTRAINT "rbac_role_name_unique" UNIQUE,
	"description" varchar(256),
	"position" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"permissions" text[]
);
--> statement-breakpoint
CREATE TABLE "rbac_user_permission" (
	"user_id" text,
	"permission" varchar(64),
	"scope" varchar(128) DEFAULT '*',
	"granted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_user_permission_user_id_permission_scope_pk" PRIMARY KEY("user_id","permission","scope")
);
--> statement-breakpoint
CREATE TABLE "rbac_user_role" (
	"user_id" text,
	"role_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "notification_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"token" text NOT NULL CONSTRAINT "notification_device_token_unique" UNIQUE,
	"platform" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(400) NOT NULL,
	"description" text,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"submission_id" uuid NOT NULL,
	"field_id" uuid,
	"answer_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_answer_option" (
	"answer_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_event_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"form_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"type" "form_event_form_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_event_type" UNIQUE("event_id","type")
);
--> statement-breakpoint
CREATE TABLE "form_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"form_id" uuid NOT NULL,
	"title" varchar(400) NOT NULL,
	"type" "form_field_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_group_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"form_id" uuid NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"email_receiver_on_submit" varchar(256),
	"can_submit_multiple" boolean DEFAULT true NOT NULL,
	"is_open_for_submissions" boolean DEFAULT false NOT NULL,
	"only_for_group_members" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"opens_at" timestamp,
	"closes_at" timestamp,
	CONSTRAINT "unique_group_form" UNIQUE("form_id","group_slug")
);
--> statement-breakpoint
CREATE TABLE "form_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"field_id" uuid NOT NULL,
	"title" varchar(400) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"form_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(200) NOT NULL,
	"header" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"image_alt" varchar(255),
	"created_by_user_id" text,
	"emojis_allowed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "news_reaction" (
	"user_id" text,
	"news_id" uuid,
	"emoji" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_reaction_user_id_news_id_pk" PRIMARY KEY("user_id","news_id")
);
--> statement-breakpoint
CREATE TABLE "job_job_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(200) NOT NULL,
	"ingress" varchar(800) DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"company" varchar(200) NOT NULL,
	"location" varchar(200) NOT NULL,
	"deadline" timestamp,
	"is_continuously_hiring" boolean DEFAULT false NOT NULL,
	"job_type" "job_type" DEFAULT 'other'::"job_type" NOT NULL,
	"email" varchar(320),
	"link" text,
	"class_start" "user_class" DEFAULT 'first'::"user_class" NOT NULL,
	"class_end" "user_class" DEFAULT 'fifth'::"user_class" NOT NULL,
	"image_url" text,
	"image_alt" varchar(255),
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_allergy" (
	"slug" varchar(64) PRIMARY KEY,
	"label" varchar(128) NOT NULL,
	"description" text,
	"curated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_user_setting_allergy" (
	"user_id" text,
	"allergy_slug" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_user_setting_allergy_user_id_allergy_slug_pk" PRIMARY KEY("user_id","allergy_slug")
);
--> statement-breakpoint
CREATE TABLE "user_calendar_token" (
	"user_id" text PRIMARY KEY,
	"token" varchar(64) NOT NULL CONSTRAINT "user_calendar_token_token_unique" UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY,
	"gender" "user_gender" NOT NULL,
	"allows_photos_by_default" boolean DEFAULT false NOT NULL,
	"accepts_event_rules" boolean NOT NULL,
	"image_url" text,
	"bio_description" text,
	"github_url" varchar(256),
	"linkedin_url" varchar(256),
	"receive_mail_communication" boolean NOT NULL,
	"is_onboarded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"public_event_registrations" boolean DEFAULT true NOT NULL,
	"custom_allergies" text[] DEFAULT '{}'::text[] NOT NULL,
	"allergies_confirmed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "apikey_api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"description" text NOT NULL,
	"key_hash" text NOT NULL CONSTRAINT "apikey_api_key_key_hash_unique" UNIQUE,
	"key_prefix" text NOT NULL,
	"created_by_user_id" text,
	"last_used_at" timestamp,
	"permissions" text NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" text NOT NULL CONSTRAINT "asset_file_key_unique" UNIQUE,
	"original_filename" varchar(512) NOT NULL,
	"content_type" varchar(255),
	"size" bigint NOT NULL,
	"uploaded_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" "asset_status" DEFAULT 'staged'::"asset_status" NOT NULL,
	"promoted_at" timestamp,
	"visibility" "asset_visibility" DEFAULT 'public'::"asset_visibility" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "toddel_issue" (
	"edition" integer PRIMARY KEY,
	"title" varchar(200) NOT NULL,
	"image_url" text,
	"pdf_url" text NOT NULL,
	"published_at" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banner_banner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(200) NOT NULL,
	"description" varchar(500) NOT NULL,
	"url" text,
	"visible_from" timestamp NOT NULL,
	"visible_until" timestamp NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"link_text" varchar(100),
	"open_in_new_tab" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" "application_type" NOT NULL,
	"status" "application_status" DEFAULT 'new'::"application_status" NOT NULL,
	"submitted_by_id" text,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"signature" text NOT NULL,
	"pdf_asset_key" text,
	"internal_comment" text,
	"handled_by_id" text,
	"handled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"application_id" uuid NOT NULL,
	"asset_key" text NOT NULL,
	"kind" "application_attachment_kind" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_company_contact" (
	"application_id" uuid PRIMARY KEY,
	"company" text NOT NULL,
	"event_types" text[] NOT NULL,
	"semesters" text[] NOT NULL,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "application_expense" (
	"application_id" uuid PRIMARY KEY,
	"cc_email" text,
	"amount_nok" numeric(12,2) NOT NULL,
	"expense_date" varchar(10) NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"budget_type" "application_budget_type" NOT NULL,
	"description" text NOT NULL,
	"account_number" varchar(13) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_hs_case" (
	"application_id" uuid PRIMARY KEY,
	"case_name" text NOT NULL,
	"case_type" "application_case_type" NOT NULL,
	"background" text NOT NULL,
	"assessment" text NOT NULL,
	"recommendation" text
);
--> statement-breakpoint
CREATE TABLE "application_support" (
	"application_id" uuid PRIMARY KEY,
	"group_slug" varchar(128) NOT NULL,
	"purpose" text NOT NULL,
	"event_description" text NOT NULL,
	"justification" text NOT NULL,
	"total_amount_nok" integer NOT NULL,
	"budget_link" text,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "feedback_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" "feedback_type" NOT NULL,
	"status" "feedback_status" DEFAULT 'open'::"feedback_status" NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"author_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"rejection_reason" text
);
--> statement-breakpoint
CREATE TABLE "feedback_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"feedback_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_vote" (
	"feedback_id" uuid,
	"user_id" text,
	"value" "feedback_vote_value" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_vote_feedback_id_user_id_pk" PRIMARY KEY("feedback_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "gallery_album" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" varchar(80) NOT NULL CONSTRAINT "gallery_album_slug_unique" UNIQUE,
	"title" varchar(100) NOT NULL,
	"description" text,
	"image_url" text,
	"image_alt" varchar(200),
	"event_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_picture" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX "account_userId_idx" ON "auth_account" ("user_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_clientId_idx" ON "auth_oauth_access_token" ("client_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_sessionId_idx" ON "auth_oauth_access_token" ("session_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_userId_idx" ON "auth_oauth_access_token" ("user_id");--> statement-breakpoint
CREATE INDEX "oauthAccessToken_refreshId_idx" ON "auth_oauth_access_token" ("refresh_id");--> statement-breakpoint
CREATE INDEX "oauthClient_userId_idx" ON "auth_oauth_client" ("user_id");--> statement-breakpoint
CREATE INDEX "oauthConsent_clientId_idx" ON "auth_oauth_consent" ("client_id");--> statement-breakpoint
CREATE INDEX "oauthConsent_userId_idx" ON "auth_oauth_consent" ("user_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_clientId_idx" ON "auth_oauth_refresh_token" ("client_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_sessionId_idx" ON "auth_oauth_refresh_token" ("session_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_userId_idx" ON "auth_oauth_refresh_token" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "auth_session" ("user_id");--> statement-breakpoint
CREATE INDEX "user_approvalStatus_idx" ON "auth_user" ("approval_status");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth_verification" ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_signature_unique_idx" ON "org_contract_signature" ("contract_id","user_id");--> statement-breakpoint
CREATE INDEX "fine_group_slug_user_id_idx" ON "org_fine" ("group_slug","user_id");--> statement-breakpoint
CREATE INDEX "group_join_request_group_slug_idx" ON "org_group_join_request" ("group_slug");--> statement-breakpoint
CREATE INDEX "group_membership_group_slug_idx" ON "org_group_membership" ("group_slug");--> statement-breakpoint
CREATE INDEX "group_membership_history_group_slug_idx" ON "org_group_membership_history" ("group_slug");--> statement-breakpoint
CREATE INDEX "group_membership_history_user_id_idx" ON "org_group_membership_history" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_membership_history_stint_idx" ON "org_group_membership_history" ("user_id","group_slug","ended_at");--> statement-breakpoint
CREATE INDEX "message_event_id_idx" ON "event_message" ("event_id");--> statement-breakpoint
CREATE INDEX "payment_event_id_user_id_idx" ON "event_payment" ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "priority_pool_event_id_idx" ON "event_priority_pool" ("event_id");--> statement-breakpoint
CREATE INDEX "reaction_event_id_idx" ON "event_reaction" ("event_id");--> statement-breakpoint
CREATE INDEX "registration_event_id_status_idx" ON "event_registration" ("event_id","status");--> statement-breakpoint
CREATE INDEX "registration_pending_idx" ON "event_registration" ("event_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "strike_user_id_idx" ON "event_strike" ("user_id");--> statement-breakpoint
CREATE INDEX "notification_user_id_created_at_idx" ON "notification_notification" ("user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "notification_device_userId_idx" ON "notification_device" ("user_id");--> statement-breakpoint
CREATE INDEX "answer_option_answer_id_idx" ON "form_answer_option" ("answer_id");--> statement-breakpoint
CREATE INDEX "application_submitted_by_id_created_at_index" ON "application" ("submitted_by_id","created_at");--> statement-breakpoint
CREATE INDEX "application_type_status_created_at_index" ON "application" ("type","status","created_at");--> statement-breakpoint
CREATE INDEX "application_attachment_application_id_index" ON "application_attachment" ("application_id");--> statement-breakpoint
CREATE INDEX "feedback_item_created_at_idx" ON "feedback_item" ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_comment_feedback_id_created_at_idx" ON "feedback_comment" ("feedback_id","created_at");--> statement-breakpoint
CREATE INDEX "gallery_picture_album_id_idx" ON "gallery_picture" ("album_id");--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_token" ADD CONSTRAINT "auth_oauth_access_token_client_id_auth_oauth_client_client_id_f" FOREIGN KEY ("client_id") REFERENCES "auth_oauth_client"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_token" ADD CONSTRAINT "auth_oauth_access_token_session_id_auth_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth_session"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_token" ADD CONSTRAINT "auth_oauth_access_token_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_token" ADD CONSTRAINT "auth_oauth_access_token_refresh_id_auth_oauth_refresh_token_id_" FOREIGN KEY ("refresh_id") REFERENCES "auth_oauth_refresh_token"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_oauth_client" ADD CONSTRAINT "auth_oauth_client_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_oauth_consent" ADD CONSTRAINT "auth_oauth_consent_client_id_auth_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth_oauth_client"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_oauth_consent" ADD CONSTRAINT "auth_oauth_consent_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD CONSTRAINT "auth_oauth_refresh_token_client_id_auth_oauth_client_client_id_" FOREIGN KEY ("client_id") REFERENCES "auth_oauth_client"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD CONSTRAINT "auth_oauth_refresh_token_session_id_auth_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth_session"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD CONSTRAINT "auth_oauth_refresh_token_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_contract" ADD CONSTRAINT "org_contract_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD CONSTRAINT "org_contract_signature_contract_id_org_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "org_contract"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD CONSTRAINT "org_contract_signature_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_fine" ADD CONSTRAINT "org_fine_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_fine" ADD CONSTRAINT "org_fine_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_fine" ADD CONSTRAINT "org_fine_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "org_fine" ADD CONSTRAINT "org_fine_approved_by_user_id_auth_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "org_fine" ADD CONSTRAINT "org_fine_law_id_org_group_law_id_fk" FOREIGN KEY ("law_id") REFERENCES "org_group_law"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "org_group" ADD CONSTRAINT "org_group_fines_admin_id_auth_user_id_fk" FOREIGN KEY ("fines_admin_id") REFERENCES "auth_user"("id");--> statement-breakpoint
ALTER TABLE "org_group" ADD CONSTRAINT "org_group_institute_id_org_institute_id_fk" FOREIGN KEY ("institute_id") REFERENCES "org_institute"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "org_group" ADD CONSTRAINT "org_group_study_program_id_org_study_program_id_fk" FOREIGN KEY ("study_program_id") REFERENCES "org_study_program"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "org_group_join_request" ADD CONSTRAINT "org_group_join_request_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_join_request" ADD CONSTRAINT "org_group_join_request_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_law" ADD CONSTRAINT "org_group_law_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_membership" ADD CONSTRAINT "org_group_membership_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_membership" ADD CONSTRAINT "org_group_membership_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_membership_history" ADD CONSTRAINT "org_group_membership_history_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_membership_history" ADD CONSTRAINT "org_group_membership_history_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_position" ADD CONSTRAINT "org_group_position_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_position" ADD CONSTRAINT "org_group_position_linked_group_slug_org_group_slug_fk" FOREIGN KEY ("linked_group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_position_holder" ADD CONSTRAINT "org_group_position_holder_position_id_org_group_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "org_group_position"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_position_holder" ADD CONSTRAINT "org_group_position_holder_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_group_position_holder" ADD CONSTRAINT "org_group_position_holder_granted_by_auth_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "org_study_program_membership" ADD CONSTRAINT "org_study_program_membership_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "org_study_program_membership" ADD CONSTRAINT "org_study_program_membership_study_program_id_org_study_program" FOREIGN KEY ("study_program_id") REFERENCES "org_study_program"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_category_slug_event_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "event_category"("slug");--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_contact_person_id_auth_user_id_fk" FOREIGN KEY ("contact_person_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_update_by_user_id_auth_user_id_fk" FOREIGN KEY ("update_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_organizer_group_slug_org_group_slug_fk" FOREIGN KEY ("organizer_group_slug") REFERENCES "org_group"("slug") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_event" ADD CONSTRAINT "event_event_restricted_to_institute_id_org_institute_id_fk" FOREIGN KEY ("restricted_to_institute_id") REFERENCES "org_institute"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_favorite" ADD CONSTRAINT "event_favorite_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_favorite" ADD CONSTRAINT "event_favorite_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_message" ADD CONSTRAINT "event_message_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_message" ADD CONSTRAINT "event_message_sent_by_id_auth_user_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_payment" ADD CONSTRAINT "event_payment_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_payment" ADD CONSTRAINT "event_payment_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_priority_pool" ADD CONSTRAINT "event_priority_pool_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_priority_pool" ADD CONSTRAINT "event_priority_pool_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_priority_pool_group" ADD CONSTRAINT "event_priority_pool_group_priority_pool_id_event_priority_pool_" FOREIGN KEY ("priority_pool_id") REFERENCES "event_priority_pool"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_priority_pool_group" ADD CONSTRAINT "event_priority_pool_group_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_priority_user" ADD CONSTRAINT "event_priority_user_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_priority_user" ADD CONSTRAINT "event_priority_user_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_reaction" ADD CONSTRAINT "event_reaction_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_reaction" ADD CONSTRAINT "event_reaction_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_strike" ADD CONSTRAINT "event_strike_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_strike" ADD CONSTRAINT "event_strike_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rbac_user_permission" ADD CONSTRAINT "rbac_user_permission_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rbac_user_permission" ADD CONSTRAINT "rbac_user_permission_granted_by_auth_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "rbac_user_role" ADD CONSTRAINT "rbac_user_role_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rbac_user_role" ADD CONSTRAINT "rbac_user_role_role_id_rbac_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "rbac_role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_notification" ADD CONSTRAINT "notification_notification_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_device" ADD CONSTRAINT "notification_device_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_answer" ADD CONSTRAINT "form_answer_submission_id_form_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "form_submission"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_answer" ADD CONSTRAINT "form_answer_field_id_form_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "form_field"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "form_answer_option" ADD CONSTRAINT "form_answer_option_answer_id_form_answer_id_fk" FOREIGN KEY ("answer_id") REFERENCES "form_answer"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_answer_option" ADD CONSTRAINT "form_answer_option_option_id_form_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "form_option"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_event_form" ADD CONSTRAINT "form_event_form_form_id_form_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "form_form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_event_form" ADD CONSTRAINT "form_event_form_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_field" ADD CONSTRAINT "form_field_form_id_form_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "form_form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_group_form" ADD CONSTRAINT "form_group_form_form_id_form_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "form_form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_group_form" ADD CONSTRAINT "form_group_form_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_option" ADD CONSTRAINT "form_option_field_id_form_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "form_field"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_form_id_form_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "form_form"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "news_news" ADD CONSTRAINT "news_news_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "news_reaction" ADD CONSTRAINT "news_reaction_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "news_reaction" ADD CONSTRAINT "news_reaction_news_id_news_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "news_news"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_job_post" ADD CONSTRAINT "job_job_post_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "user_user_setting_allergy" ADD CONSTRAINT "user_user_setting_allergy_user_id_user_settings_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_settings"("user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_user_setting_allergy" ADD CONSTRAINT "user_user_setting_allergy_allergy_slug_user_allergy_slug_fk" FOREIGN KEY ("allergy_slug") REFERENCES "user_allergy"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_calendar_token" ADD CONSTRAINT "user_calendar_token_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "apikey_api_key" ADD CONSTRAINT "apikey_api_key_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "asset_file" ADD CONSTRAINT "asset_file_uploaded_by_id_auth_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "banner_banner" ADD CONSTRAINT "banner_banner_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_submitted_by_id_auth_user_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_handled_by_id_auth_user_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "application_attachment" ADD CONSTRAINT "application_attachment_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_company_contact" ADD CONSTRAINT "application_company_contact_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_expense" ADD CONSTRAINT "application_expense_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_expense" ADD CONSTRAINT "application_expense_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "application_hs_case" ADD CONSTRAINT "application_hs_case_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_support" ADD CONSTRAINT "application_support_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_support" ADD CONSTRAINT "application_support_group_slug_org_group_slug_fk" FOREIGN KEY ("group_slug") REFERENCES "org_group"("slug") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "feedback_item" ADD CONSTRAINT "feedback_item_author_id_auth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "feedback_comment" ADD CONSTRAINT "feedback_comment_feedback_id_feedback_item_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "feedback_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feedback_comment" ADD CONSTRAINT "feedback_comment_author_id_auth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "feedback_vote" ADD CONSTRAINT "feedback_vote_feedback_id_feedback_item_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "feedback_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feedback_vote" ADD CONSTRAINT "feedback_vote_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "gallery_album" ADD CONSTRAINT "gallery_album_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "event_event"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "gallery_album" ADD CONSTRAINT "gallery_album_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "gallery_picture" ADD CONSTRAINT "gallery_picture_album_id_gallery_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "gallery_album"("id") ON DELETE CASCADE;