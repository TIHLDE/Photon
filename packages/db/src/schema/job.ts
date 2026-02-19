import { relations } from "drizzle-orm";
import {
    boolean,
    pgEnum,
    pgTableCreator,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `job_${name}`);

export const jobTypeVariants = [
    "full_time",
    "part_time",
    "summer_job",
    "other",
] as const;

export const jobType = pgEnum("job_type", jobTypeVariants);

export type JobType = (typeof jobTypeVariants)[number];

export const userClassVariants = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "alumni",
] as const;

export const userClass = pgEnum("user_class", userClassVariants);

export type UserClass = (typeof userClassVariants)[number];

export const jobPost = pgTable("job_post", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 200 }).notNull(),
    ingress: varchar("ingress", { length: 800 }).default("").notNull(),
    body: text("body").default("").notNull(),
    company: varchar("company", { length: 200 }).notNull(),
    location: varchar("location", { length: 200 }).notNull(),
    deadline: timestamp("deadline"),
    isContinuouslyHiring: boolean("is_continuously_hiring")
        .default(false)
        .notNull(),
    jobType: jobType("job_type").default("other").notNull(),
    email: varchar("email", { length: 320 }),
    link: text("link"),
    classStart: userClass("class_start").default("first").notNull(),
    classEnd: userClass("class_end").default("fifth").notNull(),
    imageUrl: text("image_url"),
    imageAlt: varchar("image_alt", { length: 255 }),
    createdById: text("created_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    ...timestamps,
});

export const jobPostRelations = relations(jobPost, ({ one }) => ({
    creator: one(user, {
        fields: [jobPost.createdById],
        references: [user.id],
    }),
}));
