import { relations } from "drizzle-orm";
import {
    index,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

// NOTE: literal full table names instead of pgTableCreator. The creator's
// prefix is runtime-only, so at the type level this table would be called
// "feedback" and collide with event.ts's `eventFeedback`, silently breaking
// relational query inference.

/**
 * Idé eller feilmelding fra et medlem — the "tilbakemelding" page.
 *
 * Lepton modelled these as a polymorphic base with `Bug` and `Idea`
 * subclasses, three tables to hold one extra discriminator. The subclasses
 * carried `url`, `browser` and `platform` for bugs, but the frontend never
 * sent any of them (all 17 migrated bugs have them empty), so the port keeps
 * a single table with a `type` column and drops the dead columns.
 */
export const feedbackTypeVariants = ["idea", "bug"] as const;

export const feedbackType = pgEnum("feedback_type", feedbackTypeVariants);

export type FeedbackType = (typeof feedbackType)["enumValues"][number];

/** Behandlingsstatus. Norwegian labels live in the UI, not in the database. */
export const feedbackStatusVariants = [
    "open",
    "in_progress",
    "closed",
    "rejected",
] as const;

export const feedbackStatus = pgEnum("feedback_status", feedbackStatusVariants);

export type FeedbackStatus = (typeof feedbackStatus)["enumValues"][number];

export const feedback = pgTable(
    "feedback_item",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        type: feedbackType("type").notNull(),
        status: feedbackStatus("status").notNull().default("open"),
        title: varchar("title", { length: 100 }).notNull(),
        description: text("description").notNull().default(""),
        /**
         * Nullable on purpose: a member leaving TIHLDE must not delete the
         * bug reports they filed. Lepton did the same (`SET NULL`).
         *
         * Kept private: the API only ever answers whether the caller is the
         * author, so they can edit or delete their own. Feedback is shown
         * anonymously — no name reaches other members or moderators.
         */
        authorId: text("author_id").references(() => user.id, {
            onDelete: "set null",
        }),
        ...timestamps,
    },
    (t) => [index("feedback_item_created_at_idx").on(t.createdAt)],
);

/**
 * En stemme opp eller ned. Lepton stored these as generic `:thumbs-up:` /
 * `:thumbs-down:` emoji reactions, which let a user hold both at once — the
 * frontend had to delete the opposite reaction by hand before adding one.
 * One row per user per feedback with a direction makes that impossible.
 */
export const feedbackVoteValueVariants = ["up", "down"] as const;

export const feedbackVoteValue = pgEnum(
    "feedback_vote_value",
    feedbackVoteValueVariants,
);

export type FeedbackVoteValue =
    (typeof feedbackVoteValue)["enumValues"][number];

export const feedbackVote = pgTable(
    "feedback_vote",
    {
        feedbackId: uuid("feedback_id")
            .notNull()
            .references(() => feedback.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        value: feedbackVoteValue("value").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [primaryKey({ columns: [t.feedbackId, t.userId] })],
);

export const feedbackRelations = relations(feedback, ({ one, many }) => ({
    author: one(user, {
        fields: [feedback.authorId],
        references: [user.id],
    }),
    votes: many(feedbackVote),
}));

export const feedbackVoteRelations = relations(feedbackVote, ({ one }) => ({
    feedback: one(feedback, {
        fields: [feedbackVote.feedbackId],
        references: [feedback.id],
    }),
    user: one(user, {
        fields: [feedbackVote.userId],
        references: [user.id],
    }),
}));

export type Feedback = typeof feedback.$inferSelect;
export type FeedbackVote = typeof feedbackVote.$inferSelect;
