import { relations } from "drizzle-orm";
import {
    boolean,
    integer,
    pgEnum,
    pgTableCreator,
    text,
    unique,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";
import { event } from "./event";
import { group } from "./org";

const pgTable = pgTableCreator((name) => `form_${name}`);

// ===== ENUMS =====

export const formFieldTypeVariants = [
    "text_answer",
    "multiple_select",
    "single_select",
] as const;

export const formFieldType = pgEnum("form_field_type", formFieldTypeVariants);

export type FormFieldType = (typeof formFieldTypeVariants)[number];

export const eventFormTypeVariants = ["survey", "evaluation"] as const;

export const eventFormType = pgEnum(
    "form_event_form_type",
    eventFormTypeVariants,
);

export type EventFormType = (typeof eventFormTypeVariants)[number];

// ===== BASE FORM =====

export const form = pgTable("form", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 400 }).notNull(),
    description: text("description"),
    isTemplate: boolean("is_template").default(false).notNull(),
    ...timestamps,
});

export const formRelations = relations(form, ({ many }) => ({
    fields: many(formField),
    submissions: many(formSubmission),
    eventForms: many(formEventForm),
    groupForms: many(formGroupForm),
}));

// ===== EVENT FORM =====

export const formEventForm = pgTable(
    "event_form",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        formId: uuid("form_id")
            .references(() => form.id, { onDelete: "cascade" })
            .notNull(),
        eventId: uuid("event_id")
            .references(() => event.id, { onDelete: "cascade" })
            .notNull(),
        type: eventFormType("type").notNull(),
        ...timestamps,
    },
    (t) => [unique("unique_event_type").on(t.eventId, t.type)],
);

export const formEventFormRelations = relations(formEventForm, ({ one }) => ({
    form: one(form, {
        fields: [formEventForm.formId],
        references: [form.id],
    }),
    event: one(event, {
        fields: [formEventForm.eventId],
        references: [event.id],
    }),
}));

// ===== GROUP FORM =====

export const formGroupForm = pgTable("group_form", {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
        .references(() => form.id, { onDelete: "cascade" })
        .notNull(),
    groupSlug: varchar("group_slug", { length: 128 })
        .references(() => group.slug, { onDelete: "cascade" })
        .notNull(),
    emailReceiverOnSubmit: varchar("email_receiver_on_submit", {
        length: 256,
    }),
    canSubmitMultiple: boolean("can_submit_multiple").default(true).notNull(),
    isOpenForSubmissions: boolean("is_open_for_submissions")
        .default(false)
        .notNull(),
    onlyForGroupMembers: boolean("only_for_group_members")
        .default(false)
        .notNull(),
    ...timestamps,
});

export const formGroupFormRelations = relations(formGroupForm, ({ one }) => ({
    form: one(form, {
        fields: [formGroupForm.formId],
        references: [form.id],
    }),
    group: one(group, {
        fields: [formGroupForm.groupSlug],
        references: [group.slug],
    }),
}));

// ===== FIELD =====

export const formField = pgTable("field", {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
        .references(() => form.id, { onDelete: "cascade" })
        .notNull(),
    title: varchar("title", { length: 400 }).notNull(),
    type: formFieldType("type").notNull(),
    required: boolean("required").default(false).notNull(),
    order: integer("order").notNull().default(0),
    ...timestamps,
});

export const formFieldRelations = relations(formField, ({ one, many }) => ({
    form: one(form, {
        fields: [formField.formId],
        references: [form.id],
    }),
    options: many(formOption),
    answers: many(formAnswer),
}));

// ===== OPTION =====

export const formOption = pgTable("option", {
    id: uuid("id").primaryKey().defaultRandom(),
    fieldId: uuid("field_id")
        .references(() => formField.id, { onDelete: "cascade" })
        .notNull(),
    title: varchar("title", { length: 400 }).notNull(),
    order: integer("order").notNull().default(0),
    ...timestamps,
});

export const formOptionRelations = relations(formOption, ({ one, many }) => ({
    field: one(formField, {
        fields: [formOption.fieldId],
        references: [formField.id],
    }),
    answers: many(formAnswerOption),
}));

// ===== SUBMISSION =====

export const formSubmission = pgTable("submission", {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
        .references(() => form.id, { onDelete: "cascade" })
        .notNull(),
    userId: text("user_id")
        .references(() => user.id, { onDelete: "cascade" })
        .notNull(),
    ...timestamps,
});

export const formSubmissionRelations = relations(
    formSubmission,
    ({ one, many }) => ({
        form: one(form, {
            fields: [formSubmission.formId],
            references: [form.id],
        }),
        user: one(user, {
            fields: [formSubmission.userId],
            references: [user.id],
        }),
        answers: many(formAnswer),
    }),
);

// ===== ANSWER =====

export const formAnswer = pgTable("answer", {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
        .references(() => formSubmission.id, { onDelete: "cascade" })
        .notNull(),
    fieldId: uuid("field_id").references(() => formField.id, {
        onDelete: "set null",
    }),
    answerText: text("answer_text"),
    ...timestamps,
});

export const formAnswerRelations = relations(formAnswer, ({ one, many }) => ({
    submission: one(formSubmission, {
        fields: [formAnswer.submissionId],
        references: [formSubmission.id],
    }),
    field: one(formField, {
        fields: [formAnswer.fieldId],
        references: [formField.id],
    }),
    selectedOptions: many(formAnswerOption),
}));

// ===== ANSWER-OPTION (Many-to-Many) =====

export const formAnswerOption = pgTable("answer_option", {
    answerId: uuid("answer_id")
        .references(() => formAnswer.id, { onDelete: "cascade" })
        .notNull(),
    optionId: uuid("option_id")
        .references(() => formOption.id, { onDelete: "cascade" })
        .notNull(),
    ...timestamps,
});

export const formAnswerOptionRelations = relations(
    formAnswerOption,
    ({ one }) => ({
        answer: one(formAnswer, {
            fields: [formAnswerOption.answerId],
            references: [formAnswer.id],
        }),
        option: one(formOption, {
            fields: [formAnswerOption.optionId],
            references: [formOption.id],
        }),
    }),
);
