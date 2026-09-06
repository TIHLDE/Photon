-- Bøtebildene lå offentlig mens boten selv krevde innlogging. Nøkkelen kan
-- ikke gjettes, men en skjult lenke har ingen sperre: den som en gang har sett
-- bildet beholder tilgangen for alltid, også etter å ha sluttet i TIHLDE.
--
-- Objektnøklene røres ikke — `org_fine.image` peker på dem, og prod-bøtta
-- ligger mot en objektkvote som avviser all skriving.

--> statement-breakpoint
UPDATE "asset_file"
SET "visibility" = 'private', "updated_at" = now()
WHERE "visibility" = 'public'
  AND "key" LIKE 'fine-images/%';

--> statement-breakpoint
-- Bøtebilder lastet opp gjennom Photon ligger under `uploads/`, side om side
-- med forsidebilder, så nøkkelen alene skiller dem ikke — raden som peker på
-- dem må avgjøre. Nøkkelen hentes ut av URL-en framfor å sammenlignes med
-- LIKE, fordi nøklene inneholder `_`, som LIKE ville lest som jokertegn.
UPDATE "asset_file"
SET "visibility" = 'private', "updated_at" = now()
WHERE "visibility" = 'public'
  AND "key" IN (
      SELECT substring("image" from '/api/assets/(.*)$')
      FROM "org_fine"
      WHERE "image" LIKE '%/api/assets/%'
  );
