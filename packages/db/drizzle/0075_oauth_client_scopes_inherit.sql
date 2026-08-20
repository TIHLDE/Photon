--
-- La OAuth-klientene arve scope-lista fra provideren.
--
-- `/oauth2/authorize` validates a request against `client.scopes ?? opts.scopes`
-- — the client's own column wins whenever it holds anything at all. Every row
-- here carries one, frozen at the moment the client was created, and none of
-- them can be edited: the admin panel has no scope field, and the plugin's
-- update endpoint only lets a client's own creator touch it (two of these rows
-- have no creator at all).
--
-- The result was #644: the discovery document advertises `offline_access`
-- because that comes from the provider list, while Proton's stored list stops
-- at `email`, so asking for it failed the whole authorization with
-- `invalid_scope` — not just the refresh token, the login.
--
-- Clearing the column makes the provider list in `packages/auth/src/index.ts`
-- the single source: discovery, validation and the client all read it, and a
-- scope added there reaches every client without a data fix like this one.
--
-- Only rows that ask for nothing beyond that list are cleared. Should a client
-- ever have been narrowed on purpose — or widened past what we advertise — the
-- WHERE misses it and its list stays, for a human to decide.
--
-- One behavioural change worth naming: a request that omits `scope` entirely
-- now defaults to all four rather than three, so such a client is handed
-- `offline_access` it never asked for. It only turns into a refresh token if
-- the client is also allowed the `refresh_token` grant, and every client here
-- is a TIHLDE app.
--
UPDATE "auth_oauth_client"
SET "scopes" = NULL
WHERE "scopes" IS NOT NULL
  AND "scopes" <@ ARRAY['openid', 'profile', 'email', 'offline_access']::text[];
