import { relations } from "drizzle-orm";
import {
    boolean,
    pgEnum,
    pgTableCreator,
    primaryKey,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `user_${name}`);

// ===== ENUMS =====

export const genderVariants = ["male", "female", "other"] as const;

export const gender = pgEnum("user_gender", genderVariants);

export type Gender = (typeof genderVariants)[number];

// ===== TABLES =====

export const userSettings = pgTable("settings", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    gender: gender("gender"),
    allowsPhotosByDefault: boolean("allows_photos_by_default")
        .default(false)
        .notNull(),
    acceptsEventRules: boolean("accepts_event_rules").default(false).notNull(),
    image: text("image"),
    bioDescription: text("bio_description"),
    githubUrl: varchar("github_url", { length: 256 }),
    linkedinUrl: varchar("linkedin_url", { length: 256 }),
    receiveMailCommunication: boolean("receive_mail_communication")
        .default(true)
        .notNull(),
    ...timestamps,
});

export const userSettingsRelations = relations(
    userSettings,
    ({ one, many }) => ({
        user: one(user, {
            fields: [userSettings.userId],
            references: [user.id],
        }),
        allergies: many(userAllergy),
    }),
);

export const allergy = pgTable("allergy", {
    slug: varchar("slug", { length: 64 }).primaryKey(),
    label: varchar("label", { length: 128 }).notNull(),
    description: text("description"),
});

export const allergyRelations = relations(allergy, ({ many }) => ({
    users: many(userAllergy),
}));

export const userAllergy = pgTable(
    "user_allergy",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        allergySlug: varchar("allergy_slug", { length: 64 })
            .notNull()
            .references(() => allergy.slug, { onDelete: "cascade" }),
        ...timestamps,
    },
    (t) => [primaryKey({ columns: [t.userId, t.allergySlug] })],
);

export const userAllergyRelations = relations(userAllergy, ({ one }) => ({
    user: one(user, {
        fields: [userAllergy.userId],
        references: [user.id],
    }),
    allergy: one(allergy, {
        fields: [userAllergy.allergySlug],
        references: [allergy.slug],
    }),
}));
