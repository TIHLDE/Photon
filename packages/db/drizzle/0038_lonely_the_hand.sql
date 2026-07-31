-- Kontaktskjema (bedriftshenvendelser) moves out of the "applications"
-- permission domain and becomes its own "company-contact" domain, so it can be
-- granted as a separate checkbox without handing out the søknad inbox.
--
-- Data-only migration: rename the existing grants, and give everyone who held
-- the all-types søknad grant the new permission so nobody silently loses the
-- kontaktskjema inbox they had yesterday.

-- Roles -----------------------------------------------------------------
UPDATE "rbac_role"
SET "permissions" = array_replace(
        array_replace("permissions", 'applications:company-contact:view', 'company-contact:view'),
        'applications:company-contact:manage', 'company-contact:manage'
    )
WHERE "permissions" && ARRAY['applications:company-contact:view', 'applications:company-contact:manage'];
--> statement-breakpoint

UPDATE "rbac_role"
SET "permissions" = "permissions" || ARRAY['company-contact:view']
WHERE 'applications:view' = ANY("permissions")
  AND NOT ('company-contact:view' = ANY("permissions"));
--> statement-breakpoint

UPDATE "rbac_role"
SET "permissions" = "permissions" || ARRAY['company-contact:manage']
WHERE 'applications:manage' = ANY("permissions")
  AND NOT ('company-contact:manage' = ANY("permissions"));
--> statement-breakpoint

-- Verv (group positions) ------------------------------------------------
UPDATE "org_group_position"
SET "permissions" = array_replace(
        array_replace("permissions", 'applications:company-contact:view', 'company-contact:view'),
        'applications:company-contact:manage', 'company-contact:manage'
    )
WHERE "permissions" && ARRAY['applications:company-contact:view', 'applications:company-contact:manage'];
--> statement-breakpoint

UPDATE "org_group_position"
SET "permissions" = "permissions" || ARRAY['company-contact:view']
WHERE 'applications:view' = ANY("permissions")
  AND NOT ('company-contact:view' = ANY("permissions"));
--> statement-breakpoint

UPDATE "org_group_position"
SET "permissions" = "permissions" || ARRAY['company-contact:manage']
WHERE 'applications:manage' = ANY("permissions")
  AND NOT ('company-contact:manage' = ANY("permissions"));
--> statement-breakpoint

-- Direct user grants ----------------------------------------------------
-- (user_id, permission, scope) is the primary key, so drop any row that would
-- collide with the renamed one before renaming.
DELETE FROM "rbac_user_permission" old
WHERE old."permission" IN ('applications:company-contact:view', 'applications:company-contact:manage')
  AND EXISTS (
      SELECT 1 FROM "rbac_user_permission" new
      WHERE new."user_id" = old."user_id"
        AND new."scope" = old."scope"
        AND new."permission" = replace(old."permission", 'applications:company-contact:', 'company-contact:')
  );
--> statement-breakpoint

UPDATE "rbac_user_permission"
SET "permission" = replace("permission", 'applications:company-contact:', 'company-contact:')
WHERE "permission" IN ('applications:company-contact:view', 'applications:company-contact:manage');
--> statement-breakpoint

INSERT INTO "rbac_user_permission" ("user_id", "permission", "scope", "granted_by")
SELECT "user_id",
       CASE "permission" WHEN 'applications:view' THEN 'company-contact:view' ELSE 'company-contact:manage' END,
       "scope",
       "granted_by"
FROM "rbac_user_permission"
WHERE "permission" IN ('applications:view', 'applications:manage')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- API keys hold their permissions as a JSON array in a text column.
UPDATE "apikey_api_key"
SET "permissions" = replace("permissions", 'applications:company-contact:', 'company-contact:')
WHERE "permissions" LIKE '%applications:company-contact:%';
