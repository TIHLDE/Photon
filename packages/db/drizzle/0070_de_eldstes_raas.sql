--
-- De Eldstes Raas: the private group every former member of Hovedstyret
-- belongs to. Created here rather than in the seed because production never
-- runs the seed, and production is the environment the group is for.
--
-- `ON CONFLICT DO NOTHING` so a re-run, or an environment where somebody has
-- already made the group by hand, is a no-op rather than a failed migration.
--
INSERT INTO "org_group" ("slug", "name", "type", "description", "fine_info", "fines_activated")
VALUES (
    'de-eldstes-raas',
    'De Eldstes Raas',
    'PRIVATE',
    'De Eldstes Raas samler alle som har sittet i Hovedstyret. Du blir med automatisk når du har vært HS-medlem, uansett hva du studerer i dag eller om du er ferdig.',
    '',
    false
)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
--
-- Everyone who has already left Hovedstyret, in one go. The login hook only
-- ever sees the people who sign in, so without this the group would fill up
-- over months and the members who have stopped visiting the site would never
-- appear at all.
--
-- DISTINCT because a member with several HS stints has several history rows,
-- and what earns the seat is the person, not the stint. `role` is cast
-- explicitly: it is an enum column, and a bare literal in a SELECT arrives as
-- text, which Postgres refuses to assign.
--
INSERT INTO "org_group_membership" ("user_id", "group_slug", "role")
SELECT DISTINCT "user_id", 'de-eldstes-raas', 'member'::org_group_membership_role
FROM "org_group_membership_history"
WHERE "group_slug" = 'hs'
ON CONFLICT ("user_id", "group_slug") DO NOTHING;
