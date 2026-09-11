--
-- Flytt OAuth-klientene fra personlig eierskap til TIHLDE.
--
-- Plugin-en avgjør hvem som får røre en klient ved å se på raden: har den en
-- `user_id` må du være nettopp den brukeren, ellers må `reference_id` matche
-- det `clientReference` svarer for deg. Alt annet blir 401.
--
-- Derfor var `oauth-clients:*` umulig å delegere: klientene sto på én enkelt
-- konto, så lista var tom for alle andre og hver knapp svarte 401 — uansett
-- hvilke tilganger de hadde. To av radene sto uten eier i det hele tatt og
-- kunne ikke redigeres av noen.
--
-- `user_id` må nulles ut, ikke bare suppleres: sjekken leser den først, så en
-- rad som beholder den ville fortsatt tilhørt oppretteren alene.
--
-- Referansen er den samme konstanten som `OAUTH_CLIENT_REFERENCE` i
-- packages/auth/src/index.ts. Endres den ene må den andre følge etter.
--
UPDATE "auth_oauth_client"
SET "reference_id" = 'tihlde',
    "user_id" = NULL
WHERE "reference_id" IS DISTINCT FROM 'tihlde';
