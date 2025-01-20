import { relations } from "drizzle-orm";
import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createTable } from ".";

export const users = createTable("user", {
    id: uuid("id").defaultRandom().primaryKey(),
    username: varchar("username", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
    sessions: many(sessions)
}))

export const sessions = createTable("session", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id]
    })
}))

export const passwordResets = createTable("password_reset", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
})