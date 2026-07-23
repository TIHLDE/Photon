-- =============================================================================
-- RBAC/verv rollout for PROD — run ONCE, AFTER the deploy that applies
-- migration 0020 (org_group_position tables + org_group.leader_role_id).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rbac-rollout.sql
--
-- Prod state before this script (seeded 2026-07-23): roles root(5), admin(4),
-- hs(3, contracts only), moderator(2), member(1); index→admin linked; 26 index
-- members have admin; mathstr has root. This script converges prod to the new
-- role model from apps/api/src/db/seed/rbac.ts + org.ts.
-- =============================================================================
BEGIN;

-- 1) Shift hierarchy up to make room for alumni at position 1
UPDATE rbac_role SET position = position + 1
WHERE name IN ('root', 'admin', 'hs', 'moderator');

-- 2) Member role: position 2 + participation permissions
UPDATE rbac_role SET
    position = 2,
    description = 'Active TIHLDE member (student) — can participate in events and group life',
    permissions = ARRAY[
        'events:view','events:registrations:create','news:view','jobs:view',
        'groups:view','forms:view','fines:create'
    ]
WHERE name = 'member';

-- 3) Alumni role (view-only, no event registration)
INSERT INTO rbac_role (name, description, position, permissions) VALUES (
    'alumni',
    'Former TIHLDE member — view access and own history, no event registration',
    1,
    ARRAY['events:view','news:view','jobs:view','groups:view']
) ON CONFLICT (name) DO NOTHING;

-- 4) HS role: broad content/ops — everything EXCEPT root, roles:*, api-keys:*,
--    oauth-clients:* and events:payments:refund (those come from HS titles)
UPDATE rbac_role SET
    description = 'Hovedstyret — all content/ops permissions; role management and refunds are granted via HS titles',
    permissions = ARRAY[
        'users:view','users:create','users:update','users:delete','users:manage',
        'events:view','events:create','events:update','events:delete','events:manage',
        'events:registrations:view','events:registrations:create','events:registrations:delete',
        'events:registrations:checkin','events:registrations:manage',
        'events:feedback:view','events:feedback:create','events:feedback:update','events:feedback:delete',
        'events:payments:view','events:payments:create','events:payments:update','events:payments:delete',
        'groups:view','groups:create','groups:update','groups:delete','groups:manage',
        'fines:view','fines:create','fines:update','fines:delete','fines:manage',
        'contracts:view','contracts:create','contracts:update','contracts:delete','contracts:manage',
        'forms:view','forms:create','forms:update','forms:delete','forms:manage',
        'news:view','news:create','news:update','news:delete','news:manage',
        'news:reactions:create','news:reactions:delete',
        'jobs:view','jobs:create','jobs:update','jobs:delete','jobs:manage'
    ]
WHERE name = 'hs';

-- 5) Link the hs group to the hs role, and backfill current HS members
UPDATE org_group SET role_id = (SELECT id FROM rbac_role WHERE name = 'hs')
WHERE slug = 'hs';

INSERT INTO rbac_user_role (user_id, role_id)
SELECT m.user_id, (SELECT id FROM rbac_role WHERE name = 'hs')
FROM org_group_membership m WHERE m.group_slug = 'hs'
ON CONFLICT DO NOTHING;

-- 6) HS titles (verv). Holders are assigned afterwards in /admin/roller.
INSERT INTO org_group_position (group_slug, name, description, permissions, scope) VALUES
('hs','President','Leder av Arbeidsutvalget og TIHLDE',
    ARRAY['roles:view','roles:create','roles:update','roles:delete','roles:assign'],'global'),
('hs','Visepresident','Del av Arbeidsutvalget',
    ARRAY['roles:view','roles:create','roles:update','roles:delete','roles:assign'],'global'),
('hs','Finansminister','Del av Arbeidsutvalget, styrer økonomien',
    ARRAY['roles:view','roles:create','roles:update','roles:delete','roles:assign','events:payments:view','events:payments:refund'],'global'),
('hs','Sosialminister','Leder av Sosialen, kan refundere arrangementsbetalinger',
    ARRAY['events:payments:view','events:payments:refund'],'global'),
('hs','Teknologiminister','Leder av Index — full systemtilgang (root)',
    ARRAY['root'],'global')
ON CONFLICT DO NOTHING;

-- 7) Teknologiminister-tittelen til mathstr (root flyttes med tittelen ved
--    fremtidige skifter; den direkte root-rollen fra 2026-07-23 kan beholdes
--    eller fjernes — tittelen er nå kilden)
INSERT INTO org_group_position_holder (position_id, user_id, granted_by)
SELECT p.id, u.id, u.id
FROM org_group_position p, auth_user u
WHERE p.group_slug = 'hs' AND p.name = 'Teknologiminister' AND u.username = 'mathstr'
ON CONFLICT DO NOTHING;

-- 8) NOK-leder: refund følger ledervervet via leader_role_id
INSERT INTO rbac_role (name, description, position, permissions) VALUES (
    'nok-leder',
    'Leder av Næringsliv og Kurs — kan refundere arrangementsbetalinger',
    1,
    ARRAY['events:payments:view','events:payments:refund']
) ON CONFLICT (name) DO NOTHING;

UPDATE org_group SET leader_role_id = (SELECT id FROM rbac_role WHERE name = 'nok-leder')
WHERE slug = 'nok';

INSERT INTO rbac_user_role (user_id, role_id)
SELECT m.user_id, (SELECT id FROM rbac_role WHERE name = 'nok-leder')
FROM org_group_membership m WHERE m.group_slug = 'nok' AND m.role = 'leader'
ON CONFLICT DO NOTHING;

-- 9) Study programs (Feide sync is a no-op without these)
INSERT INTO org_study_program (display_name, feide_code, slug, type) VALUES
('Dataingeniør','BIDATA','dataingenir','bachelor'),
('Digital Forretningsutvikling','ITBAITBEDR','digital-forretningsutvikling','bachelor'),
('Digital Infrastruktur og Cybersikkerhet','BDIGSEC','digital-infrastruktur-og-cybersikkerhet','bachelor'),
('Digital Samhandling','ITMAIKTSA','digital-samhandling','master'),
('Drift','ITBAINFODR','drift-studie','bachelor'),
('Informasjonsbehandling','ITBAINFO','informasjonsbehandling','bachelor')
ON CONFLICT (feide_code) DO NOTHING;

-- 10) Baseline backfill: give ALL existing users the member role now, so
--     nobody is locked out of event registration before their next Feide
--     login. The Feide sync (syncBaselineRoles) downgrades alumni to the
--     alumni role automatically the next time they log in.
INSERT INTO rbac_user_role (user_id, role_id)
SELECT u.id, (SELECT id FROM rbac_role WHERE name = 'member')
FROM auth_user u
ON CONFLICT DO NOTHING;

COMMIT;

-- Verify
SELECT r.name, r.position, cardinality(r.permissions) AS perms, count(ur.user_id) AS users
FROM rbac_role r LEFT JOIN rbac_user_role ur ON ur.role_id = r.id
GROUP BY r.id ORDER BY r.position DESC;
SELECT name, scope FROM org_group_position WHERE group_slug = 'hs';
SELECT slug, role_id, leader_role_id FROM org_group WHERE slug IN ('hs','index','nok');
SELECT count(*) FROM org_study_program;
