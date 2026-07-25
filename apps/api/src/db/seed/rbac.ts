import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

/**
 * Seed RBAC-related tables (role, userRole, userPermission)
 *
 * Role model (grill-me session 2026-07-23):
 * - root:      full access incl. the root wildcard. Held via the
 *              Teknologiminister title in HS, not assigned broadly.
 * - admin:     everything except root. Auto-assigned to Index members via
 *              the index group's roleId.
 * - hs:        broad content/ops role for Hovedstyret — everything EXCEPT
 *              role management, API keys, OAuth clients and payment refunds.
 *              Those powers come from HS titles (AU → roles:*, Sosialminister
 *              → refund) instead. Auto-assigned via the hs group's roleId.
 * - member:    baseline for ACTIVE students, synced by the Feide hook
 *              (syncBaselineRoles). Can participate: view + register for
 *              events, view content, propose fines (group permissionMode
 *              still applies).
 * - alumni:    baseline for former members without active study affiliation.
 *              View-only: keeps access to content and their own history, but
 *              cannot register for events.
 */
/**
 * Permission domains HS does NOT get — governed by titles instead.
 *
 * NOTE: the hs role is built by SUBTRACTION from the full permission list,
 * so every permission added to the registry lands on HS by default. Any
 * new domain that should be narrower than "all of Hovedstyret" has to be
 * excluded here explicitly.
 */
const HS_EXCLUDED_PREFIXES = [
    "roles:",
    "api-keys:",
    "oauth-clients:",
    // Utlegg are the Finansminister's; idrettslagsstøtte is IdKom's.
    "applications:expense:",
    "applications:sports-support:",
] as const;

const HS_EXCLUDED = new Set([
    "root",
    "events:payments:refund",
    // The all-types application grants would hand back what the two
    // prefixes above just excluded.
    "applications:view",
    "applications:manage",
]);

/** The permission set each managed role is supposed to hold. */
async function managedRolePermissions(): Promise<Record<string, string[]>> {
    const { PERMISSIONS } = await import("@photon/auth/rbac");

    return {
        root: Array.from(PERMISSIONS),
        admin: Array.from(PERMISSIONS).filter((p) => p !== "root"),
        hs: Array.from(PERMISSIONS).filter(
            (p) =>
                !HS_EXCLUDED.has(p) &&
                !HS_EXCLUDED_PREFIXES.some((prefix) => p.startsWith(prefix)),
        ),
        idkom: [
            "applications:sports-support:view",
            "applications:sports-support:manage",
        ],
    };
}

/**
 * Additively sync the managed roles' permissions.
 *
 * Runs on EVERY boot, not just the first — the role inserts below are
 * onConflictDoNothing, so an environment seeded before a permission existed
 * would otherwise never pick it up. Only ever adds; never removes something
 * an admin granted by hand in /admin/roller.
 */
export async function backfillRolePermissions({ db }: AppContext) {
    // Roles introduced after an environment was first seeded have to be
    // created here, not just in the first-run seed below. `position` is not
    // unique — idkom sits alongside member because it is an extra hat, not a
    // step up the hierarchy.
    await db
        .insert(schema.role)
        .values({
            name: "idkom",
            description:
                "IdKom — behandler søknader om støtte til idrettslag og undergrupper",
            position: 2,
            permissions: [
                "applications:sports-support:view",
                "applications:sports-support:manage",
            ],
        })
        .onConflictDoNothing();

    for (const [roleName, expected] of Object.entries(
        await managedRolePermissions(),
    )) {
        const existing = await db.query.role.findFirst({
            where: eq(schema.role.name, roleName),
        });
        if (!existing) continue;

        const current = new Set(existing.permissions ?? []);
        const missing = expected.filter((p) => !current.has(p));
        if (missing.length === 0) continue;

        await db
            .update(schema.role)
            .set({ permissions: [...(existing.permissions ?? []), ...missing] })
            .where(eq(schema.role.id, existing.id));
    }
}

export default async ({ db }: AppContext) => {
    // Seed RBAC defaults - Create default roles with hierarchy
    // NOTE: These positions are ONLY for initial seeding!
    // In production, use createRole() which automatically positions roles.
    // Positions should be contiguous (1, 2, 3, 4...) where higher = better role.
    // The shifting logic handles insertions automatically!
    const { PERMISSIONS } = await import("@photon/auth/rbac");

    // Root role - highest in hierarchy (position 5)
    await db
        .insert(schema.role)
        .values({
            name: "root",
            description: "System administrator with full access",
            position: 5, // Manually set ONLY for seeding - highest number = highest role
            permissions: Array.from(PERMISSIONS),
        })
        .onConflictDoNothing();

    // Admin role - second highest (position 4)
    await db
        .insert(schema.role)
        .values({
            name: "admin",
            description: "Administrator with most permissions",
            position: 4, // Just below root
            permissions: Array.from(PERMISSIONS).filter((p) => p !== "root"),
        })
        .onConflictDoNothing();

    // Hovedstyret role (position 3)
    // Auto-assigned to members of the "hs" group via group.roleId. Broad
    // content/ops access; role management and refunds come from HS titles.
    await db
        .insert(schema.role)
        .values({
            name: "hs",
            description:
                "Hovedstyret — all content/ops permissions; role management and refunds are granted via HS titles",
            position: 3, // Below admin
            permissions: Array.from(PERMISSIONS).filter(
                (p) =>
                    !HS_EXCLUDED.has(p) &&
                    !HS_EXCLUDED_PREFIXES.some((prefix) =>
                        p.startsWith(prefix),
                    ),
            ),
        })
        .onConflictDoNothing();

    // Member role - baseline for active students (position 2)
    // Assigned/revoked automatically by the Feide sync (syncBaselineRoles).
    await db
        .insert(schema.role)
        .values({
            name: "member",
            description:
                "Active TIHLDE member (student) — can participate in events and group life",
            position: 2,
            permissions: [
                "events:view",
                "events:registrations:create",
                "news:view",
                "jobs:view",
                "groups:view",
                "forms:view",
                // Proposing fines for fellow group members; the group's
                // permissionMode still decides who may manage them.
                "fines:create",
            ],
        })
        .onConflictDoNothing();

    // Alumni role - baseline for former members (position 1)
    // View-only: no event registration ("events:registrations:create").
    await db
        .insert(schema.role)
        .values({
            name: "alumni",
            description:
                "Former TIHLDE member — view access and own history, no event registration",
            position: 1, // Lowest role
            permissions: [
                "events:view",
                "news:view",
                "jobs:view",
                "groups:view",
            ],
        })
        .onConflictDoNothing();

    // IdKom role (position 2, alongside member — it is an extra hat, not a
    // step up the hierarchy). Auto-assigned to IdKom members via the idkom
    // group's roleId so the whole committee can handle idrettslagssøknader.
    await db
        .insert(schema.role)
        .values({
            name: "idkom",
            description:
                "IdKom — behandler søknader om støtte til idrettslag og undergrupper",
            position: 2,
            permissions: [
                "applications:sports-support:view",
                "applications:sports-support:manage",
            ],
        })
        .onConflictDoNothing();
};
