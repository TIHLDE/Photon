--
-- «Raas» var feil: gruppa heter De Eldstes Raad.
--
-- The slug moves with the name, which cannot be done as an UPDATE: every
-- foreign key pointing at org_group.slug is ON UPDATE NO ACTION, so renaming
-- the parent while children reference it is rejected. Hence insert, move,
-- delete — the same three steps a slug change has always taken here.
--
-- Safe to do at all because the group is a day old and nothing but its roster
-- points at it: 43 membership rows in production and zero fines, laws, verv,
-- forms, events, priority pools or applications. A group with history behind
-- it would need the other ten tables moved too.
--
INSERT INTO "org_group" (
    "slug", "name", "type", "description", "contact_email",
    "fine_info", "fines_activated", "image_url", "logo_url",
    "member_permissions", "member_global_permissions",
    "leader_permissions", "leader_global_permissions",
    "contract_signing_required", "created_at"
)
SELECT
    'de-eldstes-raad',
    'De Eldstes Raad',
    "type",
    'De Eldstes Raad samler dem som har båret et av TIHLDEs tillitsverv: Hovedstyret, fondsforvalteren, og ridderne. Du blir med automatisk når du får vervet, og blir stående etterpå — uansett hva du studerer i dag eller om du er ferdig.',
    -- Uten kontakt-e-post avviser API-et enhver redigering av gruppa: skjemaet
    -- sender alltid feltet, og tom streng er ikke en gyldig adresse. Gruppa var
    -- derfor umulig å redigere fra dag én, botsystemet inkludert.
    'hs@tihlde.org',
    "fine_info", "fines_activated", "image_url", "logo_url",
    "member_permissions", "member_global_permissions",
    "leader_permissions", "leader_global_permissions",
    "contract_signing_required", "created_at"
FROM "org_group"
WHERE "slug" = 'de-eldstes-raas'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

UPDATE "org_group_membership" SET "group_slug" = 'de-eldstes-raad'
WHERE "group_slug" = 'de-eldstes-raas'
  AND EXISTS (SELECT 1 FROM "org_group" WHERE "slug" = 'de-eldstes-raad');--> statement-breakpoint

-- Ingen rader i prod i dag, men en fjerning rukket i mellomtiden er nettopp
-- det som holder noen ute av gruppa. Den må ikke bli borte i flyttingen.
UPDATE "org_group_membership_history" SET "group_slug" = 'de-eldstes-raad'
WHERE "group_slug" = 'de-eldstes-raas'
  AND EXISTS (SELECT 1 FROM "org_group" WHERE "slug" = 'de-eldstes-raad');--> statement-breakpoint

DELETE FROM "org_group" WHERE "slug" = 'de-eldstes-raas';--> statement-breakpoint

--
-- Sittende hovedstyre og forvaltningsgruppens leder.
--
-- Regelen var før «tidligere HS-medlem», altså en avsluttet periode, og de
-- sittende sto derfor utenfor. Nå gir vervet plassen med en gang, og de 9 som
-- sitter i HS i dag — pluss fondsforvalteren — hører hjemme her uten å måtte
-- logge inn først.
--
-- Den som er meldt ut for hånd holdes ute, som ellers.
--
INSERT INTO "org_group_membership" ("user_id", "group_slug", "role")
SELECT DISTINCT m."user_id", 'de-eldstes-raad', 'member'::org_group_membership_role
FROM "org_group_membership" m
WHERE (
        m."group_slug" = 'hs'
     OR (m."group_slug" = 'forvaltningsgruppen' AND m."role" = 'leader')
    )
  AND EXISTS (SELECT 1 FROM "org_group" WHERE "slug" = 'de-eldstes-raad')
  AND NOT EXISTS (
        SELECT 1 FROM "org_group_membership_history" h
        WHERE h."user_id" = m."user_id" AND h."group_slug" = 'de-eldstes-raad'
    )
ON CONFLICT ("user_id", "group_slug") DO NOTHING;--> statement-breakpoint

-- Og de som har hatt vervene før, men hvis periode tok slutt før koden fantes.
INSERT INTO "org_group_membership" ("user_id", "group_slug", "role")
SELECT DISTINCT h."user_id", 'de-eldstes-raad', 'member'::org_group_membership_role
FROM "org_group_membership_history" h
WHERE (
        h."group_slug" = 'hs'
     OR (h."group_slug" = 'forvaltningsgruppen' AND h."role" = 'leader')
    )
  AND EXISTS (SELECT 1 FROM "org_group" WHERE "slug" = 'de-eldstes-raad')
  AND NOT EXISTS (
        SELECT 1 FROM "org_group_membership_history" h2
        WHERE h2."user_id" = h."user_id" AND h2."group_slug" = 'de-eldstes-raad'
    )
ON CONFLICT ("user_id", "group_slug") DO NOTHING;
