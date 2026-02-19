import {
    integer,
    pgTableCreator,
    primaryKey,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `rbac_${name}`);

export const role = pgTable("role", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 64 }).notNull().unique(),
    description: varchar("description", { length: 256 }),
    position: integer("position").notNull().default(1000),
    permissions: text("permissions").array(),
    ...timestamps,
});

export const userRole = pgTable(
    "user_role",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        roleId: integer("role_id")
            .notNull()
            .references(() => role.id, { onDelete: "cascade" }),
        ...timestamps,
    },
    (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

/**
 * Direct user permissions - for granting individual permissions without creating roles.
 * Supports optional scoping to specific resources (e.g., "group:fotball", "event:123").
 *
 * Examples:
 * - { userId: "123", permission: "events:create", scope: "*" } → Can create any event (global)
 * - { userId: "123", permission: "events:update", scope: "group:fotball" } → Can only update events for football group
 * - { userId: "456", permission: "fines:manage", scope: "group:index" } → Can manage fines for Index group
 */
export const userPermission = pgTable(
    "user_permission",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        permission: varchar("permission", { length: 64 }).notNull(),
        /**
         * Scope for the permission. "*" means global (no restriction).
         * Format: "resource_type:resource_id"
         * Examples: "group:fotball", "event:123abc", "*" (global)
         */
        scope: varchar("scope", { length: 128 }).notNull().default("*"),
        /**
         * User who granted this permission (for audit trail)
         */
        grantedBy: text("granted_by").references(() => user.id, {
            onDelete: "set null",
        }),
        ...timestamps,
    },
    (t) => [
        // Composite primary key: userId + permission + scope ("*" means global)
        primaryKey({
            columns: [t.userId, t.permission, t.scope],
        }),
    ],
);
