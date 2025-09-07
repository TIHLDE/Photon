import {
    integer,
    pgTableCreator,
    primaryKey,
    serial,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `rbac_${name}`);

export const role = pgTable("role", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 64 }).notNull().unique(),
    description: varchar("description", { length: 256 }),
    position: integer("position").notNull().default(1000),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const permission = pgTable("permission", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull().unique(),
    description: varchar("description", { length: 256 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const rolePermission = pgTable(
    "role_permission",
    {
        roleId: integer("role_id")
            .notNull()
            .references(() => role.id, { onDelete: "cascade" }),
        permissionId: integer("permission_id")
            .notNull()
            .references(() => permission.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRole = pgTable(
    "user_role",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        roleId: integer("role_id")
            .notNull()
            .references(() => role.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);
