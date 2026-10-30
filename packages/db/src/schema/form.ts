import { defineRelationsPart } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    pgEnum,
    pgTableCreator,
    text,
    timestamp,
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
// ===== EVENT FORM =====

export const formEventForm = pgTable(
    "event_form",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        formId: uuid("form_id")
            .references(() => form.id, {
                name: "form_event_form_form_id_form_form_id_fk",
                onDelete: "cascade",
            })
            .notNull(),
        eventId: uuid("event_id")
            .references(() => event.id, {
                name: "form_event_form_event_id_event_event_id_fk",
                onDelete: "cascade",
            })
            .notNull(),
        type: eventFormType("type").notNull(),
        ...timestamps,
    },
    (t) => [unique("unique_event_type").on(t.eventId, t.type)],
);
// ===== GROUP FORM =====

export const formGroupForm = pgTable(
    "group_form",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        formId: uuid("form_id")
            .references(() => form.id, {
                name: "form_group_form_form_id_form_form_id_fk",
                onDelete: "cascade",
            })
            .notNull(),
        groupSlug: varchar("group_slug", { length: 128 })
            .references(() => group.slug, {
                name: "form_group_form_group_slug_org_group_slug_fk",
                onDelete: "cascade",
            })
            .notNull(),
        emailReceiverOnSubmit: varchar("email_receiver_on_submit", {
            length: 256,
        }),
        canSubmitMultiple: boolean("can_submit_multiple")
            .default(true)
            .notNull(),
        isOpenForSubmissions: boolean("is_open_for_submissions")
            .default(false)
            .notNull(),
        onlyForGroupMembers: boolean("only_for_group_members")
            .default(false)
            .notNull(),
        ...timestamps,
        /**
         * Når skjemaet skal åpne seg selv. Null betyr «med en gang», altså at
         * `is_open_for_submissions` alene avgjør. Er tidspunktet satt og ikke
         * passert, er skjemaet stengt selv om bryteren står på — det er slik
         * man planlegger et skjema fram i tid uten å måtte huske å åpne det.
         */
        opensAt: timestamp("opens_at"),
        /**
         * Når skjemaet skal stenge seg selv. Null betyr «ingen frist», altså
         * at det står åpent til noen stenger det. Er tidspunktet passert, er
         * skjemaet stengt selv om bryteren står på — det er slik man setter en
         * svarfrist uten å måtte huske å stenge skjemaet.
         */
        closesAt: timestamp("closes_at"),
    },
    // A form belongs to a group once. Several read paths look the row up on
    // form_id alone with findFirst, so a duplicate does not surface as an
    // error — it silently answers from whichever copy comes back first, and
    // is_open_for_submissions or only_for_group_members can be read off the
    // wrong one. The Lepton import produced exactly that (three copies of all
    // 28 rows in prod); this makes the state unreachable rather than merely
    // unwritten.
    (t) => [unique("unique_group_form").on(t.formId, t.groupSlug)],
);
// ===== FIELD =====

export const formField = pgTable("field", {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
        .references(() => form.id, {
            name: "form_field_form_id_form_form_id_fk",
            onDelete: "cascade",
        })
        .notNull(),
    title: varchar("title", { length: 400 }).notNull(),
    type: formFieldType("type").notNull(),
    required: boolean("required").default(false).notNull(),
    order: integer("order").notNull().default(0),
    ...timestamps,
});
// ===== OPTION =====

export const formOption = pgTable("option", {
    id: uuid("id").primaryKey().defaultRandom(),
    fieldId: uuid("field_id")
        .references(() => formField.id, {
            name: "form_option_field_id_form_field_id_fk",
            onDelete: "cascade",
        })
        .notNull(),
    title: varchar("title", { length: 400 }).notNull(),
    order: integer("order").notNull().default(0),
    ...timestamps,
});
// ===== SUBMISSION =====

export const formSubmission = pgTable("submission", {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
        .references(() => form.id, {
            name: "form_submission_form_id_form_form_id_fk",
            onDelete: "cascade",
        })
        .notNull(),
    userId: text("user_id")
        .references(() => user.id, {
            name: "form_submission_user_id_auth_user_id_fk",
            onDelete: "cascade",
        })
        .notNull(),
    ...timestamps,
});
// ===== ANSWER =====

export const formAnswer = pgTable("answer", {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
        .references(() => formSubmission.id, {
            name: "form_answer_submission_id_form_submission_id_fk",
            onDelete: "cascade",
        })
        .notNull(),
    fieldId: uuid("field_id").references(() => formField.id, {
        name: "form_answer_field_id_form_field_id_fk",
        onDelete: "set null",
    }),
    answerText: text("answer_text"),
    ...timestamps,
});
// ===== ANSWER-OPTION (Many-to-Many) =====

export const formAnswerOption = pgTable(
    "answer_option",
    {
        answerId: uuid("answer_id")
            .references(() => formAnswer.id, {
                name: "form_answer_option_answer_id_form_answer_id_fk",
                onDelete: "cascade",
            })
            .notNull(),
        optionId: uuid("option_id")
            .references(() => formOption.id, {
                name: "form_answer_option_option_id_form_option_id_fk",
                onDelete: "cascade",
            })
            .notNull(),
        ...timestamps,
    },
    (t) => [
        /**
         * The largest table in the database with no index at all: 110 265
         * rows, read in full every time a submission needed the options
         * picked for one of its answers.
         */
        index("answer_option_answer_id_idx").on(t.answerId),
    ],
);

export const formRelations = defineRelationsPart(
    {
        form,
        formEventForm,
        formGroupForm,
        formField,
        formOption,
        formSubmission,
        formAnswer,
        formAnswerOption,
        event,
        group,
        user,
    },
    (r) => ({
        form: {
            fields: r.many.formField({
                from: r.form.id,
                to: r.formField.formId,
            }),
            submissions: r.many.formSubmission({
                from: r.form.id,
                to: r.formSubmission.formId,
            }),
            eventForms: r.many.formEventForm({
                from: r.form.id,
                to: r.formEventForm.formId,
            }),
            groupForms: r.many.formGroupForm({
                from: r.form.id,
                to: r.formGroupForm.formId,
            }),
        },
        formEventForm: {
            form: r.one.form({
                from: r.formEventForm.formId,
                to: r.form.id,
                optional: false,
            }),
            event: r.one.event({
                from: r.formEventForm.eventId,
                to: r.event.id,
                optional: false,
            }),
        },
        formGroupForm: {
            form: r.one.form({
                from: r.formGroupForm.formId,
                to: r.form.id,
                optional: false,
            }),
            group: r.one.group({
                from: r.formGroupForm.groupSlug,
                to: r.group.slug,
                optional: false,
            }),
        },
        formField: {
            form: r.one.form({
                from: r.formField.formId,
                to: r.form.id,
                optional: false,
            }),
            options: r.many.formOption({
                from: r.formField.id,
                to: r.formOption.fieldId,
            }),
            answers: r.many.formAnswer({
                from: r.formField.id,
                to: r.formAnswer.fieldId,
            }),
        },
        formOption: {
            field: r.one.formField({
                from: r.formOption.fieldId,
                to: r.formField.id,
                optional: false,
            }),
            answers: r.many.formAnswerOption({
                from: r.formOption.id,
                to: r.formAnswerOption.optionId,
            }),
        },
        formSubmission: {
            form: r.one.form({
                from: r.formSubmission.formId,
                to: r.form.id,
                optional: false,
            }),
            user: r.one.user({
                from: r.formSubmission.userId,
                to: r.user.id,
                optional: false,
            }),
            answers: r.many.formAnswer({
                from: r.formSubmission.id,
                to: r.formAnswer.submissionId,
            }),
        },
        formAnswer: {
            submission: r.one.formSubmission({
                from: r.formAnswer.submissionId,
                to: r.formSubmission.id,
                optional: false,
            }),
            field: r.one.formField({
                from: r.formAnswer.fieldId,
                to: r.formField.id,
            }),
            selectedOptions: r.many.formAnswerOption({
                from: r.formAnswer.id,
                to: r.formAnswerOption.answerId,
            }),
        },
        formAnswerOption: {
            answer: r.one.formAnswer({
                from: r.formAnswerOption.answerId,
                to: r.formAnswer.id,
                optional: false,
            }),
            option: r.one.formOption({
                from: r.formAnswerOption.optionId,
                to: r.formOption.id,
                optional: false,
            }),
        },
    }),
);
