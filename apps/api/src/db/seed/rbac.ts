import { schema } from "@photon/db";
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
export default async ({ db }: AppContext) => {
    // Seed RBAC defaults - Create default roles with hierarchy
    // NOTE: These positions are ONLY for initial seeding!
    // In production, use createRole() which automatically positions roles.
    // Positions should be contiguous (1, 2, 3, 4...) where higher = better role.
    // The shifting logic handles insertions automatically!
    const { PERMISSIONS } = await import("@photon/auth/rbac");

    /** Permission domains HS does NOT get — governed by titles instead. */
    const HS_EXCLUDED_PREFIXES = [
        "roles:",
        "api-keys:",
        "oauth-clients:",
    ] as const;
    const HS_EXCLUDED = new Set(["root", "events:payments:refund"]);

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
};
