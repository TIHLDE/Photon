ALTER TABLE "org_group" ADD COLUMN "member_permissions" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_group" ADD COLUMN "member_global_permissions" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Carry the group→role links onto the group itself.
--
-- `admin` (Index), `hs` (Hovedstyret) and `idkom` were auto-assigned to every
-- member on join via org_group.role_id, which made "everyone in Index is an
-- administrator" a fact you could only find in the database. Same access, now
-- in a column the admin panel renders and can edit.
UPDATE "org_group" g
SET "member_global_permissions" = COALESCE(r."permissions", '{}')
FROM "rbac_role" r
WHERE g."role_id" = r."id"
  AND cardinality(g."member_global_permissions") = 0;
--> statement-breakpoint
-- The leader-bound role (e.g. NOK's leader refunding payments) becomes the
-- group's leader permission set. Deliberately group-scoped rather than global:
-- the role existed to give THIS group's leader a power, and scoping it says so.
-- Expected to be a no-op — nothing in the seed ever set leader_role_id.
UPDATE "org_group" g
SET "leader_permissions" = ARRAY(
    SELECT DISTINCT unnest(g."leader_permissions" || COALESCE(r."permissions", '{}'))
)
FROM "rbac_role" r
WHERE g."leader_role_id" = r."id";
--> statement-breakpoint
-- Every leader used to hold these for their own group from a hardcoded
-- constant (LEADER_BASELINE_PERMISSIONS). The constant is gone, so the list
-- moves into each group's own editable set — same access, now visible and
-- switchable per group instead of being true everywhere by fiat.
UPDATE "org_group"
SET "leader_permissions" = ARRAY(
    SELECT DISTINCT unnest("leader_permissions" || ARRAY[
        'events:view',
        'events:create',
        'events:update',
        'events:delete',
        'events:registrations:view',
        'events:registrations:create',
        'events:registrations:delete',
        'events:registrations:checkin',
        'events:registrations:manage',
        'events:feedback:view',
        'events:payments:view'
    ]::text[])
);
--> statement-breakpoint
-- Bøter left the permission system entirely — they follow group membership
-- now — so strip the dead grants rather than leave them looking meaningful in
-- the admin panel.
UPDATE "rbac_role"
SET "permissions" = ARRAY(
    SELECT p FROM unnest("permissions") AS p WHERE p NOT LIKE 'fines:%'
);
--> statement-breakpoint
UPDATE "org_group_position"
SET "permissions" = ARRAY(
    SELECT p FROM unnest("permissions") AS p WHERE p NOT LIKE 'fines:%'
);
--> statement-breakpoint
-- Including the lists just copied off the roles above, which were written
-- before this strip ran and would otherwise carry fines:* forward.
UPDATE "org_group"
SET "leader_permissions" = ARRAY(
    SELECT p FROM unnest("leader_permissions") AS p WHERE p NOT LIKE 'fines:%'
),
"member_permissions" = ARRAY(
    SELECT p FROM unnest("member_permissions") AS p WHERE p NOT LIKE 'fines:%'
),
"member_global_permissions" = ARRAY(
    SELECT p FROM unnest("member_global_permissions") AS p WHERE p NOT LIKE 'fines:%'
);
--> statement-breakpoint
DELETE FROM "rbac_user_permission" WHERE "permission" LIKE 'fines:%';
--> statement-breakpoint
-- The three group roles are now redundant: membership confers the access, and
-- rbac_user_role rows cascade with the role row.
DELETE FROM "rbac_role" WHERE "name" IN ('admin', 'hs', 'idkom');
