CREATE TABLE "org_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(256) NOT NULL,
	"file_key" varchar(600) NOT NULL,
	"version" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_user_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_contract_signature" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_group" ADD COLUMN "contract_signing_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "org_group" ADD COLUMN "contract_notification_email" varchar(200);--> statement-breakpoint
ALTER TABLE "org_contract" ADD CONSTRAINT "org_contract_created_by_user_id_auth_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD CONSTRAINT "org_contract_signature_contract_id_org_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."org_contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_contract_signature" ADD CONSTRAINT "org_contract_signature_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contract_signature_unique_idx" ON "org_contract_signature" USING btree ("contract_id","user_id");