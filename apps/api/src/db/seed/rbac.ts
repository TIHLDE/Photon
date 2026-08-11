import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

/**
 * Seed RBAC-related tables (role, userRole, userPermission)
 *
 * Roles are NOT how TIHLDE hands out powers any more. What a group's members
 * may do lives on the group row (`memberPermissions` /
 * `memberGlobalPermissions`), and what an individual may do comes from a verv.
 * The `admin`, `hs` and `idkom` roles used to be auto-assigned through
 * `group.roleId`, which made "everyone in Index is an administrator" a fact
 * you could only discover in the database; they were migrated onto their
 * groups and deleted.
 *
 * Three roles remain, and none of them is administered from the UI:
 * - root:   every permission. Held in practice via the Teknologiminister
 *           title in HS, and seeded here so the roles API stays usable as an
 *           emergency way back in if that title ever loses its holder.
 * - member: baseline for ACTIVE students, synced by the Feide hook
 *           (syncBaselineRoles). Can participate: view + register for events,
 *           view content. Not a grant anyone administers — it is the floor.
 * - alumni: baseline for former members without active study affiliation.
 *           View-only: keeps access to content and their own history, but
 *           cannot register for events.
 */

/** The permission set each managed role is supposed to hold. */
async function managedRolePermissions(): Promise<Record<string, string[]>> {
    const { PERMISSIONS } = await import("@photon/auth/rbac");

    return {
        root: Array.from(PERMISSIONS),
    };
}

/**
 * Additively sync the managed roles' permissions.
 *
 * Runs on EVERY boot, not just the first — the role inserts below are
 * onConflictDoNothing, so an environment seeded before a permission existed
 * would otherwise never pick it up. Only ever adds; never removes something
 * granted by hand.
 */
export async function backfillRolePermissions({ db }: AppContext) {
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
    // Positions are Discord-style: higher number = higher in the hierarchy.
    // Only used by the roles API's "you cannot touch someone above you" guard.
    const { PERMISSIONS } = await import("@photon/auth/rbac");

    await db
        .insert(schema.role)
        .values({
            name: "root",
            description: "System administrator with full access",
            position: 3,
            permissions: Array.from(PERMISSIONS),
        })
        .onConflictDoNothing();

    // Member role - baseline for active students.
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
            ],
        })
        .onConflictDoNothing();

    // Alumni role - baseline for former members.
    // View-only: no event registration ("events:registrations:create").
    await db
        .insert(schema.role)
        .values({
            name: "alumni",
            description:
                "Former TIHLDE member — view access and own history, no event registration",
            position: 1,
            permissions: [
                "events:view",
                "news:view",
                "jobs:view",
                "groups:view",
            ],
        })
        .onConflictDoNothing();
};
