import { relations, sql } from "drizzle-orm";
import {
    boolean,
    doublePrecision,
    index,
    integer,
    pgEnum,
    pgTableCreator,
    primaryKey,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";
import { group, institute } from "./org";

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

export const eventVisibilityVariants = [
    // Visible to everyone, including logged-out visitors
    "public",

    // Visible only to authenticated (member) users
    "members",
] as const;

export const eventVisibility = pgEnum(
    "event_visibility",
    eventVisibilityVariants,
);

export type EventVisibility = (typeof eventVisibilityVariants)[number];

export const event = pgTable("event", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 256 }).notNull(),
    slug: varchar("slug", { length: 256 }).notNull().unique(),
    description: text("description"),
    categorySlug: varchar("category_slug", { length: 64 })
        .references(() => eventCategory.slug)
        .notNull(),
    location: varchar("location", { length: 256 }),
    /**
     * Koordinater for stedet, satt når adressen er valgt fra adressesøket
     * (Kartverket). Er null for fritekst-steder som "Digitalt" eller "R1".
     * Brukes til å lage en kartlenke på arrangementssiden.
     */
    locationLat: doublePrecision("location_lat"),
    locationLng: doublePrecision("location_lng"),
    imageUrl: text("image_url"),
    imageAlt: varchar("image_alt", { length: 255 }),
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
    priceMinor: integer("price"),
    // The time between sign up and it must be paid
    paymentGracePeriodMinutes: integer("payment_grace_period_minutes"),
    reactionsAllowed: boolean("reactions_allowed").default(true).notNull(),
    organizerGroupSlug: varchar("organizer_group_slug", {
        length: 128,
    }).references(() => group.slug, { onDelete: "set null" }),
    enforcesPreviousStrikes: boolean("enforces_previous_strikes").notNull(),
    /**
     * When true, this event automatically issues strikes (prikker): 1 strike
     * for unregistering after `cancellationDeadline`, and 2 strikes for
     * no-shows after the event ends. When false, no automatic strikes are given.
     */
    canCauseStrikes: boolean("can_cause_strikes").default(false).notNull(),
    /**
     * Set once the no-show strike job has processed this event after it ended.
     * Used as an idempotency marker so no-show strikes are issued only once.
     */
    noShowProcessedAt: timestamp("no_show_processed_at"),
    /**
     * Set once the "påmeldingen åpner snart" reminder has been sent to everyone
     * who favourited the event. Idempotency marker so the reminder goes out at
     * most once per registration opening — cleared again if `registrationStart`
     * is moved, so a rescheduled opening gets its own reminder.
     */
    registrationReminderSentAt: timestamp("registration_reminder_sent_at"),
    /** Only members covered by a priority pool may register. */
    onlyAllowPrioritized: boolean("only_allow_prioritized")
        .default(false)
        .notNull(),
    /**
     * Restricts registration to members of a single NTNU institute, matched
     * through the study groups they belong to. NULL — the default — means the
     * event is open to every institute, which is what nearly all events are.
     * Set it for arrangements that belong to one institute, so DigSec (IIK)
     * students cannot take IDI seats and the other way around.
     *
     * This gates registration only; the event stays visible to everyone, the
     * same way a priority-pool-only event does.
     */
    restrictedToInstituteId: integer("restricted_to_institute_id").references(
        () => institute.id,
        { onDelete: "set null" },
    ),
    /**
     * Who may see the event. "public" is visible to everyone including
     * logged-out visitors; "members" hides it from unauthenticated callers.
     */
    visibility: eventVisibility("visibility").default("public").notNull(),
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
    restrictedToInstitute: one(institute, {
        fields: [event.restrictedToInstituteId],
        references: [institute.id],
    }),
    contactPerson: one(user, {
        fields: [event.contactPersonId],
        references: [user.id],
    }),
    reactions: many(eventReaction),
    pools: many(eventPriorityPool),
    priorityUsers: many(eventPriorityUser),
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
        /**
         * Photo consent for THIS event, overriding the account-level
         * `allowsPhotosByDefault`. Carried over from Lepton, where members
         * declined photos on individual registrations.
         */
        allowPhoto: boolean("allow_photo").default(true).notNull(),
        ...timestamps,
    },
    (t) => [
        primaryKey({ columns: [t.userId, t.eventId] }),
        /**
         * The primary key leads on `user_id`, so it cannot serve a lookup by
         * event — and looking up by event is what this table mostly does:
         * capacity counts, attendee lists, the resolver's per-event pass.
         * Every one of those was a full scan of the whole table, which is why
         * `event_registration` had read 10.7 billion rows across 3.1 million
         * sequential scans by August 2026 — more than the rest of the database
         * put together.
         *
         * `status` rides along because the hot queries filter on it too
         * ("how many are `registered` for this event"), so the index can
         * answer them without touching the heap.
         */
        index("registration_event_id_status_idx").on(t.eventId, t.status),
        /**
         * The registration resolver runs every 5 seconds and asks for every
         * `pending` row in the table. Normally there are none, so a partial
         * index stays a few kilobytes and turns that scan into an empty
         * lookup. A plain index on `status` would instead be full-size, and
         * ~99% of it rows the cron never wants.
         */
        index("registration_pending_idx")
            .on(t.eventId)
            .where(sql`${t.status} = 'pending'`),
    ],
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
        receivedPaymentAt: timestamp("received_payment_at"),
        /**
         * Deadline for when this payment obligation must be fulfilled. Set when a
         * user is registered to a paid event to `now + paymentGracePeriodMinutes`.
         * A countdown job cancels the registration if payment is not completed by
         * this time.
         */
        expiresAt: timestamp("expires_at"),
        ...timestamps,
    },
    (t) => [
        /**
         * Every payment lookup starts from the event — "has this member
         * paid", "who still owes" — and the table only had its uuid
         * primary key to offer, so each one scanned all of it.
         */
        index("payment_event_id_user_id_idx").on(t.eventId, t.userId),
    ],
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
    (t) => [
        primaryKey({ columns: [t.userId, t.eventId] }),
        /**
         * The primary key leads on `user_id`, so "every reaction on this
         * event" — which is what the event page asks for — could not use it
         * and scanned the table instead.
         */
        index("reaction_event_id_idx").on(t.eventId),
    ],
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

/**
 * Enkeltpersoner som er prioritert på et arrangement.
 *
 * Bevisst en egen tabell og ikke enda et kriterium i en pool: en pool er et
 * OG av grupper, og «brukeren er Ola» kan ikke stå sammen med «brukeren er i
 * 1. klasse» uten å bety noe annet enn arrangøren mener. Her er regelen
 * flat — står du i lista, er du prioritert, på lik linje med å treffe en
 * pool.
 */
export const eventPriorityUser = pgTable(
    "priority_user",
    {
        eventId: uuid("event_id")
            .notNull()
            .references(() => event.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        ...timestamps,
    },
    (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);

export const eventPriorityUserRelations = relations(
    eventPriorityUser,
    ({ one }) => ({
        event: one(event, {
            fields: [eventPriorityUser.eventId],
            references: [event.id],
        }),
        user: one(user, {
            fields: [eventPriorityUser.userId],
            references: [user.id],
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
