import {
    integer,
    pgEnum,
    pgTableCreator,
    text,
    timestamp,
    boolean,
    varchar,
    uuid,
    decimal,
    interval,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { timestamps } from "../timestamps";

const pgTable = pgTableCreator((name) => `event_${name}`);

export const registrationStatus = pgEnum("event_registration_status", [
    "registered",
    "waitlisted",
    "cancelled",
    "attended",
    "no_show",
]);

export type RegistrationStatus =
    (typeof registrationStatus)["enumValues"][number];

export const paymentStatus = pgEnum("event_payment_status", [
    "pending",
    "paid",
    "refunded",
    "failed",
]);

export type PaymentStatus = (typeof paymentStatus)["enumValues"][number];

export const event = pgTable("event", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 256 }).notNull(),
    slug: varchar("slug", { length: 256 }).notNull().unique(),
    description: text("description"),
    categorySlug: varchar("category_slug", { length: 64 }).references(
        () => eventCategory.slug,
        { onDelete: "set null" },
    ),
    location: varchar("location", { length: 256 }),
    imageUrl: text("image_url"),
    capacity: integer("capacity"),
    allowWaitlist: boolean("allow_waitlist").default(true).notNull(),
    contactPersonId: text("contact_person_id").references(() => user.id, {
        onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    updateByUserId: text("update_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    start: timestamp("start").notNull(),
    end: timestamp("end").notNull(),
    registrationStart: timestamp("registration_start"),
    registrationEnd: timestamp("registration_end"),
    cancellationDeadline: timestamp("cancellation_deadline"),
    isRegistrationClosed: boolean("is_registration_closed")
        .default(false)
        .notNull(),
    isPaidEvent: boolean("is_paid_event").default(false).notNull(),
    requiresSigningUp: boolean("requires_signing_up").default(false).notNull(),
    price: integer("price"),
    // The time between sign up and it must be paid
    paymentGracePeriodMinutes: integer("payment_grace_period_minutes"),
    reactionsAllowed: boolean("reactions_allowed").default(true).notNull(),
    ...timestamps,
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
    ...timestamps,
});

export const eventStrike = pgTable("strike", {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    count: integer("count").notNull(),
    reason: varchar("reason", { length: 256 }),
    ...timestamps,
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
    ...timestamps,
});

export const eventFeedback = pgTable("feedback", {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    rating: integer("rating"), // 1-5 optional
    comment: text("comment"),
    ...timestamps,
});

export const eventCategory = pgTable("category", {
    slug: varchar("slug", { length: 64 }).primaryKey(),
    label: varchar("label", { length: 128 }).notNull(),
});
