import {
    integer,
    pgTableCreator,
    primaryKey,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { timestamps } from "../timestamps";

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
