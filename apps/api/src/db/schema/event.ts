import {
    integer,
    pgEnum,
    pgTableCreator,
    text,
    timestamp,
    boolean,
    varchar,
    uuid,
    primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { timestamps } from "../timestamps";
import { group } from "./org";
import { relations } from "drizzle-orm";

const pgTable = pgTableCreator((name) => `event_${name}`);

export const registrationStatusVariants = [
    // Successfully registered to the event
    "registered",

    // Is currently on waitlist (queued for spot)
    "waitlisted",

    // Spot got cancelled (failed to pay for event)
    "cancelled",

    // User has shown up to the event (registered by NOK)
    "attended",

    // User did not show up to the event (maybe receive strike)
    "no_show",

    // User has signed up, but is not yet resolved to registered or waitlist
    "pending",
] as const;

export const registrationStatus = pgEnum(
    "event_registration_status",
    registrationStatusVariants,
);

export type RegistrationStatus = (typeof registrationStatusVariants)[number];

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
    categorySlug: varchar("category_slug", { length: 64 })
        .references(() => eventCategory.slug)
        .notNull(),
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
    organizerGroupSlug: varchar("organizer_group_slug", {
        length: 128,
    }).references(() => group.slug, { onDelete: "set null" }),
    enforcesPreviousStrikes: boolean("enforces_previous_strikes").notNull(),
    ...timestamps,
});

export const eventRelations = relations(event, ({ one, many }) => ({
    category: one(eventCategory, {
        fields: [event.categorySlug],
        references: [eventCategory.slug],
    }),
    organizer: one(group, {
        fields: [event.organizerGroupSlug],
        references: [group.slug],
    }),
    reactions: many(eventReaction),
    pools: many(eventPriorityPool),
    favorites: many(eventFavorite),
    registrations: many(eventRegistration),
}));

export const eventRegistration = pgTable(
    "registration",
    {
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
    },
    (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

export const eventRegistrationRelations = relations(
    eventRegistration,
    ({ one }) => ({
        event: one(event, {
            fields: [eventRegistration.eventId],
            references: [event.id],
        }),
        user: one(user, {
            fields: [eventRegistration.userId],
            references: [user.id],
        }),
    }),
);

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

export const eventStrikeRelations = relations(eventStrike, ({ one }) => ({
    event: one(event, {
        fields: [eventStrike.eventId],
        references: [event.id],
    }),
    user: one(user, {
        fields: [eventStrike.userId],
        references: [user.id],
    }),
}));

export const eventPayment = pgTable(
    "payment",
    {
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
        receivedPaymentAt: timestamp("received_payment_at"),
        ...timestamps,
    },
    (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);

export const eventPaymentRelations = relations(eventPayment, ({ one }) => ({
    event: one(event, {
        fields: [eventPayment.eventId],
        references: [event.id],
    }),
    user: one(user, {
        fields: [eventPayment.userId],
        references: [user.id],
    }),
}));

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

export const eventFeedbackRelations = relations(eventFeedback, ({ one }) => ({
    event: one(event, {
        fields: [eventFeedback.eventId],
        references: [event.id],
    }),
    user: one(user, {
        fields: [eventFeedback.userId],
        references: [user.id],
    }),
}));

export const eventCategory = pgTable("category", {
    slug: varchar("slug", { length: 64 }).primaryKey(),
    label: varchar("label", { length: 128 }).notNull(),
});

export const eventCategoryRelations = relations(eventCategory, ({ many }) => ({
    events: many(event),
}));

export const eventReaction = pgTable(
    "reaction",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        eventId: uuid("event_id")
            .notNull()
            .references(() => event.id, { onDelete: "cascade" }),
        emoji: varchar("emoji", { length: 32 }).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

export const eventReactionRelations = relations(eventReaction, ({ one }) => ({
    user: one(user, {
        fields: [eventReaction.userId],
        references: [user.id],
    }),
    event: one(event, {
        fields: [eventReaction.eventId],
        references: [event.id],
    }),
}));

export const eventPriorityPool = pgTable("priority_pool", {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    priorityScore: integer("priority_score").notNull(),
    ...timestamps,
});

export const eventPriorityPoolRelations = relations(
    eventPriorityPool,
    ({ one, many }) => ({
        event: one(event, {
            fields: [eventPriorityPool.eventId],
            references: [event.id],
        }),
        groups: many(eventPriorityPoolGroup),
    }),
);

export const eventPriorityPoolGroup = pgTable(
    "priority_pool_group",
    {
        priorityPoolId: uuid("priority_pool_id")
            .notNull()
            .references(() => eventPriorityPool.id, { onDelete: "cascade" }),
        groupSlug: varchar("group_slug", { length: 128 })
            .notNull()
            .references(() => group.slug, { onDelete: "cascade" }),
        ...timestamps,
    },
    (t) => [primaryKey({ columns: [t.priorityPoolId, t.groupSlug] })],
);

export const eventPriorityPoolGroupRelations = relations(
    eventPriorityPoolGroup,
    ({ one }) => ({
        priorityPool: one(eventPriorityPool, {
            fields: [eventPriorityPoolGroup.priorityPoolId],
            references: [eventPriorityPool.id],
        }),
        group: one(group, {
            fields: [eventPriorityPoolGroup.groupSlug],
            references: [group.slug],
        }),
    }),
);

export const eventFavorite = pgTable(
    "favorite",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        eventId: uuid("event_id")
            .notNull()
            .references(() => event.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

export const eventFavoriteRelations = relations(eventFavorite, ({ one }) => ({
    user: one(user, {
        fields: [eventFavorite.userId],
        references: [user.id],
    }),
    event: one(event, {
        fields: [eventFavorite.eventId],
        references: [event.id],
    }),
}));
