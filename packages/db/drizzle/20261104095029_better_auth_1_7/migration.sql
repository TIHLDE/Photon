CREATE TABLE "auth_oauth_client_assertion" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_client_resource" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_resource" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"access_token_ttl" integer,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"allowed_scopes" text[],
	"custom_claims" jsonb,
	"dpop_bound_access_tokens_required" boolean DEFAULT false,
	"disabled" boolean DEFAULT false,
	"created_at" timestamp,
	"updated_at" timestamp,
	"policy_version" integer DEFAULT 1,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "auth_jwks" ADD COLUMN "alg" text;--> statement-breakpoint
ALTER TABLE "auth_jwks" ADD COLUMN "crv" text;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_token" ADD COLUMN "authorization_code_id" text;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_token" ADD COLUMN "resources" text[];--> statement-breakpoint
ALTER TABLE "auth_oauth_access_token" ADD COLUMN "requested_user_info_claims" text[];--> statement-breakpoint
ALTER TABLE "auth_oauth_access_token" ADD COLUMN "revoked" timestamp;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_token" ADD COLUMN "confirmation" jsonb;--> statement-breakpoint
ALTER TABLE "auth_oauth_client" ADD COLUMN "client_discovery_id" text;--> statement-breakpoint
ALTER TABLE "auth_oauth_client" ADD COLUMN "client_credentials_scopes" text[] DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "auth_oauth_client" ADD COLUMN "backchannel_logout_uri" text;--> statement-breakpoint
ALTER TABLE "auth_oauth_client" ADD COLUMN "backchannel_logout_session_required" boolean;--> statement-breakpoint
ALTER TABLE "auth_oauth_client" ADD COLUMN "application_type" text;--> statement-breakpoint
ALTER TABLE "auth_oauth_client" ADD COLUMN "jwks" text;--> statement-breakpoint
ALTER TABLE "auth_oauth_client" ADD COLUMN "jwks_uri" text;--> statement-breakpoint
ALTER TABLE "auth_oauth_client" ADD COLUMN "dpop_bound_access_tokens" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "auth_oauth_consent" ADD COLUMN "resources" text[];--> statement-breakpoint
ALTER TABLE "auth_oauth_consent" ADD COLUMN "requested_user_info_claims" text[];--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD COLUMN "authorization_code_id" text;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD COLUMN "resources" text[];--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD COLUMN "requested_user_info_claims" text[];--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD COLUMN "rotated_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD COLUMN "rotation_replay_response" text;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD COLUMN "rotation_replay_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_token" ADD COLUMN "confirmation" jsonb;--> statement-breakpoint
CREATE INDEX "oauthAccessToken_authorizationCodeId_idx" ON "auth_oauth_access_token" ("authorization_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauthClientResource_clientId_resourceId_uidx" ON "auth_oauth_client_resource" ("client_id","resource_id");--> statement-breakpoint
CREATE INDEX "oauthClientResource_clientId_idx" ON "auth_oauth_client_resource" ("client_id");--> statement-breakpoint
CREATE INDEX "oauthClientResource_resourceId_idx" ON "auth_oauth_client_resource" ("resource_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshToken_authorizationCodeId_idx" ON "auth_oauth_refresh_token" ("authorization_code_id");--> statement-breakpoint
ALTER TABLE "auth_oauth_client_resource" ADD CONSTRAINT "auth_oauth_client_resource_V3cS6twcRIpS_fkey" FOREIGN KEY ("client_id") REFERENCES "auth_oauth_client"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_oauth_client_resource" ADD CONSTRAINT "auth_oauth_client_resource_fHMpUNxGXloK_fkey" FOREIGN KEY ("resource_id") REFERENCES "auth_oauth_resource"("identifier") ON DELETE CASCADE;--> statement-breakpoint
-- Hand-written, as an agreed exception to "migrations hold only generated SQL".
--
-- Better Auth 1.7 stops reading `type` and `public` on OAuth clients. It reads
-- `application_type` instead, and counts a client as public only when
-- `token_endpoint_auth_method` is 'none'. Copying the values here, in the same
-- transaction that adds the columns, means no request is ever served while a
-- public client looks confidential. Only empty columns are filled, so running
-- it again never overwrites a value an admin has set.
--
-- 'user-agent-based' is a browser app. OIDC calls that 'web'; whether it keeps
-- a secret is the auth method's business.
UPDATE "auth_oauth_client"
SET "application_type" = CASE "type" WHEN 'native' THEN 'native' ELSE 'web' END
WHERE "application_type" IS NULL
  AND "type" IN ('native', 'web', 'user-agent-based');--> statement-breakpoint
UPDATE "auth_oauth_client"
SET "token_endpoint_auth_method" = CASE
    WHEN "public" IS TRUE OR "type" IN ('native', 'user-agent-based') THEN 'none'
    ELSE 'client_secret_basic'
END
WHERE "token_endpoint_auth_method" IS NULL;
