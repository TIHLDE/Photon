-- Vipps utsteder webhook-hemmeligheten én gang og viser den aldri igjen. Den
-- lå bare i Redis, som tømmes ved hver deploy, så Photon glemte sin egen
-- registrering og laget en ny hver gang uten å slette den gamle. Prod hadde
-- 15 registreringer mot samme URL 6. september; taket er 25 per hendelsestype.

CREATE TABLE "event_vipps_webhook" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
