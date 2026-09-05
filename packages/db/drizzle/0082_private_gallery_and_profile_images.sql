-- Galleribilder og profilbilder krever innlogging.
--
-- `private` betyr her «ikke for utloggede». Nedlastingsruta serverer dem
-- fortsatt, men bare til en innlogget kaller, og bare fordi en galleri- eller
-- profilrad peker på dem — kontraktsignaturer, søknadsvedlegg og bøtebilder er
-- også `private` og forblir utilgjengelige der.
--
-- Ingenting skrives til bøtta, og ingen objektnøkler endres.

--> statement-breakpoint
-- Nøkkelen hentes ut av URL-en framfor å sammenlignes med LIKE, fordi nøklene
-- inneholder `_`, som LIKE ville lest som jokertegn.
UPDATE "asset_file"
SET "visibility" = 'private', "updated_at" = now()
WHERE "visibility" = 'public'
  AND "key" IN (
      SELECT substring("image_url" from '/api/assets/(.*)$')
      FROM "gallery_picture" WHERE "image_url" LIKE '%/api/assets/%'
      UNION
      SELECT substring("image_url" from '/api/assets/(.*)$')
      FROM "gallery_album" WHERE "image_url" LIKE '%/api/assets/%'
      UNION
      SELECT substring("image_url" from '/api/assets/(.*)$')
      FROM "user_settings" WHERE "image_url" LIKE '%/api/assets/%'
      UNION
      SELECT substring("image" from '/api/assets/(.*)$')
      FROM "auth_user" WHERE "image" LIKE '%/api/assets/%'
  );
