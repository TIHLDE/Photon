-- Sett inn de kuraterte allergiene, ikke bare merk dem.
--
-- Migrasjon 0073 gjorde `UPDATE ... SET curated = true` i troen på at radene
-- allerede fantes. Det gjorde de ikke i prod: seed-scriptet kjører bare på en
-- tom database, så katalogen der består utelukkende av fritekstsvarene
-- Lepton-importen dro med seg. Bare `gluten` og `lupin` ble truffet, og det
-- var tilfeldig — noen hadde skrevet nøyaktig de ordene. Resultatet var en
-- nedtrekksliste med to valg.
--
-- Upsert framfor insert, slik at de to som finnes får riktig etikett og
-- beskrivelse i stedet for fritekstversjonen sin.
INSERT INTO "user_allergy" ("slug", "label", "description", "curated") VALUES
    ('gluten', 'Glutenholdig korn', 'Hvete, rug, bygg, havre, spelt, kamut/egyptisk hvete eller hybrider av disse', true),
    ('shellfish', 'Skalldyr', 'Skalldyr (for eksempel reker, krabbe, hummer)', true),
    ('molluscs', 'Bløtdyr', 'Bløtdyr (for eksempel muslinger, blekksprut, østers)', true),
    ('eggs', 'Egg', NULL, true),
    ('fish', 'Fisk', NULL, true),
    ('peanuts', 'Peanøtter', NULL, true),
    ('soy', 'Soya', NULL, true),
    ('milk', 'Melk', 'Melk (herunder laktose)', true),
    ('nuts', 'Nøtter', 'Nøtter (mandel, hasselnøtt, valnøtt, cashewnøtt, pekannøtt, paranøtt, pistasjnøtt, macadamianøtt/australianøtt)', true),
    ('celery', 'Selleri', NULL, true),
    ('mustard', 'Sennep', NULL, true),
    ('sesame', 'Sesamfrø', NULL, true),
    ('sulfites', 'Svoveldioksid og sulfitt', NULL, true),
    ('lupin', 'Lupin', NULL, true),
    ('vegetarian', 'Vegetar', 'Vegetarisk kostholdspreferanse', true),
    ('vegan', 'Vegan', 'Vegansk kostholdspreferanse', true),
    ('halal', 'Halal', 'Halal kostholdskrav', true),
    ('kosher', 'Kosher', 'Kosher kostholdskrav', true),
    ('other', 'Annet', 'Andre kostholdsrestriksjoner eller allergier', true)
ON CONFLICT ("slug") DO UPDATE SET
    "label" = EXCLUDED."label",
    "description" = EXCLUDED."description",
    "curated" = true;
