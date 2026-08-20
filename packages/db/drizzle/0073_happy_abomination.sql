ALTER TABLE "user_allergy" ADD COLUMN "curated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "custom_allergies" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "allergies_confirmed_at" timestamp;--> statement-breakpoint
-- Marker de kuraterte allergiene vi selv har seedet. Uten dette ville
-- nedtrekkslista i innstillingene stått tom i alle miljøer som allerede har
-- radene, siden `curated` som standard er false og seed-scriptet ikke
-- nødvendigvis kjøres på nytt ved deploy.
UPDATE "user_allergy" SET "curated" = true WHERE "slug" IN (
    'gluten', 'shellfish', 'molluscs', 'eggs', 'fish', 'peanuts', 'soy',
    'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulfites', 'lupin',
    'vegetarian', 'vegan', 'halal', 'kosher', 'other'
);
