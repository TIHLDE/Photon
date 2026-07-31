/**
 * Which permissions unlock each section of the admin panel.
 *
 * One list per section, mirroring what the API's `requireAccess` demands on
 * the endpoints that section calls. Shared by the admin sidebar, the
 * dashboard shortcuts and {@link useIsAdmin} so the entry points, the menu and
 * the pages never disagree about who may do what.
 *
 * These are checked with `sessionHasPermissionInAnyScope`: several sections
 * list resources from more than one group, and a group-scoped grant is enough
 * to have work to do there. The API still rejects the individual request when
 * the scope does not match.
 */
export const ADMIN_SECTION_PERMISSIONS = {
    // Attendance, registrations and payments all live on the per-event admin
    // page under this section, so their permissions unlock it too.
    arrangementer: [
        "events:create",
        "events:update",
        "events:delete",
        "events:manage",
        "events:payments:view",
        "events:payments:refund",
    ],
    nyheter: ["news:create", "news:manage"],
    annonser: ["jobs:create", "jobs:update", "jobs:delete", "jobs:manage"],
    bannere: [
        "banners:view",
        "banners:create",
        "banners:update",
        "banners:delete",
        "banners:manage",
    ],
    galleri: [
        "galleries:create",
        "galleries:update",
        "galleries:delete",
        "galleries:manage",
    ],
    toddel: [
        "toddel:create",
        "toddel:update",
        "toddel:delete",
        "toddel:manage",
    ],
    brukere: [
        "users:view",
        "users:create",
        "users:update",
        "users:delete",
        "users:manage",
    ],
    grupper: [
        "contracts:view",
        "contracts:manage",
        "groups:update",
        "groups:manage",
    ],
    prikker: [
        "events:strikes:view",
        "events:strikes:create",
        "events:strikes:delete",
        "events:manage",
    ],
    roller: [
        "roles:view",
        "roles:create",
        "roles:update",
        "roles:delete",
        "roles:assign",
    ],
    opptak: [
        "contracts:view",
        "contracts:create",
        "contracts:update",
        "contracts:manage",
    ],
    soknader: [
        "applications:view",
        "applications:manage",
        "applications:expense:view",
        "applications:expense:manage",
        "applications:support:view",
        "applications:support:manage",
        "applications:sports-support:view",
        "applications:sports-support:manage",
        "applications:hs-case:view",
        "applications:hs-case:manage",
    ],
    // Bedriftshenvendelser have their own page and their own grant, so
    // søknad-permissions do not unlock them.
    kontaktskjema: ["company-contact:view", "company-contact:manage"],
} as const satisfies Record<string, readonly string[]>;

export type AdminSection = keyof typeof ADMIN_SECTION_PERMISSIONS;

/**
 * Every permission that unlocks at least one admin section.
 *
 * Note this includes view-only permissions: `users:view` alone gives a real
 * page to visit, so someone holding it should still be offered the way in.
 * The baseline `member`/`alumni` roles hold none of these.
 */
export const ALL_ADMIN_SECTION_PERMISSIONS: string[] = Array.from(
    new Set(Object.values(ADMIN_SECTION_PERMISSIONS).flat()),
);
