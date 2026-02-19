import { schema } from "@photon/db";
import type { AppContext } from "~/lib/ctx";

/**
 * Seed RBAC-related tables (role, userRole, userPermission)
 */
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

    // Moderator role (position 2)
    await db
        .insert(schema.role)
        .values({
            name: "moderator",
            description: "Moderator with limited permissions",
            position: 2, // Below admin
            permissions: [
                "events:view",
                "events:create",
                "users:view",
                "roles:view",
            ],
        })
        .onConflictDoNothing();

    // Member role - lowest in hierarchy (position 1)
    await db
        .insert(schema.role)
        .values({
            name: "member",
            description: "Regular member with basic permissions",
            position: 1, // Lowest role
            permissions: ["events:view"],
        })
        .onConflictDoNothing();
};
