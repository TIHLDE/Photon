-- Sett inn de kuraterte allergiene, ikke bare merk dem.
--
-- Migrasjon 0073 gjorde `UPDATE ... SET curated = true` i troen på at radene
-- allerede fantes. Det gjorde de ikke i prod: seed-scriptet kjører bare på en
-- tom database, så katalogen der består utelukkende av fritekstsvarene
-- Lepton-importen dro med seg. Bare `gluten` og `lupin` ble truffet, og det
-- var tilfeldig — noen hadde skrevet nøyaktig de ordene. Resultatet var en
-- nedtrekksliste med to valg.
--
-- Allergenene er Mattilsynets 14, med deres egne eksempler:
-- https://www.mattilsynet.no/mat-og-drikke/merking-av-mat/slik-skal-allergenene-merkes/de-14-allergenene
--
-- Upsert framfor insert, slik at radene som finnes får den kuraterte
-- etiketten og beskrivelsen sin i stedet for fritekstversjonen.
INSERT INTO "user_allergy" ("slug", "label", "description", "curated") VALUES
    ('gluten', 'Glutenholdig korn', 'Hvete, rug, bygg, havre, spelt, korasanhvete og lignende', true),
    ('shellfish', 'Skalldyr', 'Krabbe, hummer, reker, krill, kreps og scampi', true),
    ('eggs', 'Egg', 'Egg og produkter framstilt av egg', true),
    ('fish', 'Fisk', 'Også skjult i for eksempel leverpostei og worcestersaus', true),
    ('peanuts', 'Peanøtter', 'Også i kjeks, kaker, desserter, sjokolade, iskrem, peanøttolje og peanøttsmør', true),
    ('soy', 'Soya', 'Tofu, miso, tempeh, soyasaus, soyadrikker og soyamel', true),
    ('milk', 'Melk', 'Smør, ost, fløte, iskrem, desserter, melkepulver og yoghurt. Herunder laktose', true),
    ('nuts', 'Nøtter', 'Mandler, hasselnøtter, valnøtter, kasjunøtter, pekannøtter, pistasienøtter, paranøtter og macadamianøtter', true),
    ('celery', 'Selleri', 'Stangselleri, i tillegg til blader, frø og rot', true),
    ('mustard', 'Sennep', 'Sennep, sennepspulver og sennepsfrø', true),
    ('sesame', 'Sesamfrø', 'Også i brød, knekkebrød, kjeks, hummus, vegetarretter og godteri', true),
    ('sulfites', 'Svoveldioksid og sulfitter', 'Brukes til konservering av frukt og grønnsaker', true),
    ('lupin', 'Lupin', 'Lupinfrø og lupinmel', true),
    ('molluscs', 'Bløtdyr', 'Muslinger, snegler, blekksprut, blåskjell, kamskjell, østers og hjerteskjell', true),
    ('vegetarian', 'Vegetar', 'Vegetarisk kostholdspreferanse', true),
    ('vegan', 'Vegan', 'Vegansk kostholdspreferanse', true),
    ('halal', 'Halal', 'Halal kostholdskrav', true),
    ('kosher', 'Kosher', 'Kosher kostholdskrav', true)
ON CONFLICT ("slug") DO UPDATE SET
    "label" = EXCLUDED."label",
    "description" = EXCLUDED."description",
    "curated" = true;
--> statement-breakpoint
-- «Annet» er tatt ut av valgene: det forteller kjøkkenet ingenting, og med
-- fritekst tilgjengelig er det bedre at folk skriver hva det faktisk er.
-- Raden beholdes, så de som allerede har den valgt mister den ikke — den
-- tilbys bare ikke lenger.
UPDATE "user_allergy" SET "curated" = false WHERE "slug" = 'other';
