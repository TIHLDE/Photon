import {
    integer,
    pgEnum,
    pgTableCreator,
    text,
    timestamp,
    boolean,
    varchar,
    uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `event_${name}`);

export const registrationStatus = pgEnum("event_registration_status", [
    "registered",
    "waitlisted",
    "cancelled",
    "attended",
    "no_show",
]);

export const paymentStatus = pgEnum("event_payment_status", [
    "pending",
    "paid",
    "refunded",
    "failed",
]);

export const event = pgTable("event", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description"),
    location: varchar("location", { length: 256 }),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    capacity: integer("capacity").notNull(),
    allowWaitlist: boolean("allow_waitlist").default(true).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const eventRegistration = pgTable("registration", {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    status: registrationStatus("status").notNull().default("registered"),
    waitlistPosition: integer("waitlist_position"),
    attendedAt: timestamp("attended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const eventPoint = pgTable("point", {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    reason: varchar("reason", { length: 256 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const eventPayment = pgTable("payment", {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(), // cents/øre
    currency: varchar("currency", { length: 3 }).default("NOK").notNull(),
    provider: varchar("provider", { length: 64 }),
    providerPaymentId: text("provider_payment_id"),
    status: paymentStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const eventFeedback = pgTable("feedback", {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    rating: integer("rating"), // 1-5 optional
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
