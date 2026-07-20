import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import {
    userIdMap,
    eventIdMap,
    formIdMap,
    formFieldIdMap,
    formOptionIdMap,
    formSubmissionIdMap,
    formAnswerIdMap,
    char32ToUuid,
    mapFormFieldType,
    mapEventFormType,
    batchInsert,
} from "../mappings";

interface LeptonForm {
    id: string;
    title: string;
    description: string;
    template: number;
}

interface LeptonField {
    id: string;
    form_id: string;
    title: string;
    type: string;
    required: number;
    order: number;
}

interface LeptonOption {
    id: string;
    field_id: string;
    title: string;
    order: number;
}

interface LeptonSubmission {
    id: string;
    form_id: string;
    user_id: string;
    created_at: Date;
    updated_at: Date;
}

interface LeptonAnswer {
    id: string;
    submission_id: string;
    field_id: string | null;
    answer_text: string;
    created_at: Date;
    updated_at: Date;
}

interface LeptonAnswerOption {
    answer_id: string;
    option_id: string;
}

interface LeptonEventForm {
    form_ptr_id: string;
    event_id: number;
    type: string;
}

interface LeptonGroupForm {
    form_ptr_id: string;
    group_id: string;
    can_submit_multiple: number;
    is_open_for_submissions: number;
    only_for_group_members: number;
    email_receiver_on_submit: string | null;
}

export async function migrateForms(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 10: Forms ===");

    // 1. Forms
    const forms = await query<LeptonForm>("SELECT * FROM forms_form");
    console.log(`  Found ${forms.length} forms`);

    const formRecords = forms.map((f) => {
        const newId = char32ToUuid(f.id);
        formIdMap.set(f.id, newId);
        return {
            id: newId,
            title: f.title.slice(0, 400),
            description: f.description || null,
            isTemplate: Boolean(f.template),
        };
    });

    await batchInsert(formRecords, 500, async (batch) => {
        await db.insert(schema.form).values(batch).onConflictDoNothing();
    });
    console.log(`  Inserted ${formRecords.length} forms`);

    // 2. Fields
    const fields = await query<LeptonField>("SELECT * FROM forms_field");
    console.log(`  Found ${fields.length} fields`);

    const fieldRecords = fields
        .filter((f) => formIdMap.has(f.form_id))
        .map((f) => {
            const newId = char32ToUuid(f.id);
            formFieldIdMap.set(f.id, newId);
            return {
                id: newId,
                formId: formIdMap.get(f.form_id)!,
                title: f.title.slice(0, 400),
                type: mapFormFieldType(f.type),
                required: Boolean(f.required),
                order: f.order,
            };
        });

    await batchInsert(fieldRecords, 500, async (batch) => {
        await db.insert(schema.formField).values(batch).onConflictDoNothing();
    });
    console.log(`  Inserted ${fieldRecords.length} fields`);

    // 3. Options
    const options = await query<LeptonOption>("SELECT * FROM forms_option");
    console.log(`  Found ${options.length} options`);

    const optionRecords = options
        .filter((o) => formFieldIdMap.has(o.field_id))
        .map((o) => {
            const newId = char32ToUuid(o.id);
            formOptionIdMap.set(o.id, newId);
            return {
                id: newId,
                fieldId: formFieldIdMap.get(o.field_id)!,
                title: o.title.slice(0, 400),
                order: o.order,
            };
        });

    await batchInsert(optionRecords, 500, async (batch) => {
        await db.insert(schema.formOption).values(batch).onConflictDoNothing();
    });
    console.log(`  Inserted ${optionRecords.length} options`);

    // 4. Submissions
    const submissions = await query<LeptonSubmission>(
        "SELECT * FROM forms_submission",
    );
    console.log(`  Found ${submissions.length} submissions`);

    const submissionRecords: Array<{
        id: string;
        formId: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
    }> = [];

    for (const s of submissions) {
        const newFormId = formIdMap.get(s.form_id);
        const newUserId = userIdMap.get(s.user_id);
        if (!newFormId || !newUserId) continue;

        const newId = char32ToUuid(s.id);
        formSubmissionIdMap.set(s.id, newId);

        submissionRecords.push({
            id: newId,
            formId: newFormId,
            userId: newUserId,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
        });
    }

    await batchInsert(submissionRecords, 500, async (batch) => {
        await db
            .insert(schema.formSubmission)
            .values(batch)
            .onConflictDoNothing();
    });
    console.log(`  Inserted ${submissionRecords.length} submissions`);

    // 5. Answers
    const answers = await query<LeptonAnswer>("SELECT * FROM forms_answer");
    console.log(`  Found ${answers.length} answers`);

    const answerRecords: Array<{
        id: string;
        submissionId: string;
        fieldId: string | null;
        answerText: string | null;
        createdAt: Date;
        updatedAt: Date;
    }> = [];

    for (const a of answers) {
        const newSubmissionId = formSubmissionIdMap.get(a.submission_id);
        if (!newSubmissionId) continue;

        const newId = char32ToUuid(a.id);
        formAnswerIdMap.set(a.id, newId);

        answerRecords.push({
            id: newId,
            submissionId: newSubmissionId,
            fieldId: a.field_id
                ? (formFieldIdMap.get(a.field_id) ?? null)
                : null,
            answerText: a.answer_text || null,
            createdAt: a.created_at,
            updatedAt: a.updated_at,
        });
    }

    await batchInsert(answerRecords, 500, async (batch) => {
        await db.insert(schema.formAnswer).values(batch).onConflictDoNothing();
    });
    console.log(`  Inserted ${answerRecords.length} answers`);

    // 6. Answer-option junctions
    const answerOptions = await query<LeptonAnswerOption>(
        "SELECT * FROM forms_answer_selected_options",
    );
    console.log(`  Found ${answerOptions.length} answer-option links`);

    const aoRecords: Array<{ answerId: string; optionId: string }> = [];

    for (const ao of answerOptions) {
        const newAnswerId = formAnswerIdMap.get(ao.answer_id);
        const newOptionId = formOptionIdMap.get(ao.option_id);
        if (!newAnswerId || !newOptionId) continue;

        aoRecords.push({ answerId: newAnswerId, optionId: newOptionId });
    }

    await batchInsert(aoRecords, 500, async (batch) => {
        await db
            .insert(schema.formAnswerOption)
            .values(batch)
            .onConflictDoNothing();
    });
    console.log(`  Inserted ${aoRecords.length} answer-option links`);

    // 7. Event forms
    const eventForms = await query<LeptonEventForm>(
        "SELECT * FROM forms_eventform",
    );
    console.log(`  Found ${eventForms.length} event forms`);

    const eventFormRecords: Array<{
        id: string;
        formId: string;
        eventId: string;
        type: "survey" | "evaluation";
    }> = [];

    for (const ef of eventForms) {
        const newFormId = formIdMap.get(ef.form_ptr_id);
        const newEventId = eventIdMap.get(ef.event_id);
        if (!newFormId || !newEventId) continue;

        eventFormRecords.push({
            id: crypto.randomUUID(),
            formId: newFormId,
            eventId: newEventId,
            type: mapEventFormType(ef.type),
        });
    }

    await batchInsert(eventFormRecords, 500, async (batch) => {
        await db
            .insert(schema.formEventForm)
            .values(batch)
            .onConflictDoNothing();
    });
    console.log(`  Inserted ${eventFormRecords.length} event forms`);

    // 8. Group forms
    const groupForms = await query<LeptonGroupForm>(
        "SELECT * FROM forms_groupform",
    );
    console.log(`  Found ${groupForms.length} group forms`);

    const groupFormRecords: Array<{
        id: string;
        formId: string;
        groupSlug: string;
        emailReceiverOnSubmit: string | null;
        canSubmitMultiple: boolean;
        isOpenForSubmissions: boolean;
        onlyForGroupMembers: boolean;
    }> = [];

    for (const gf of groupForms) {
        const newFormId = formIdMap.get(gf.form_ptr_id);
        if (!newFormId) continue;

        groupFormRecords.push({
            id: crypto.randomUUID(),
            formId: newFormId,
            groupSlug: gf.group_id,
            emailReceiverOnSubmit:
                gf.email_receiver_on_submit?.slice(0, 256) ?? null,
            canSubmitMultiple: Boolean(gf.can_submit_multiple),
            isOpenForSubmissions: Boolean(gf.is_open_for_submissions),
            onlyForGroupMembers: Boolean(gf.only_for_group_members),
        });
    }

    await batchInsert(groupFormRecords, 500, async (batch) => {
        await db
            .insert(schema.formGroupForm)
            .values(batch)
            .onConflictDoNothing();
    });
    console.log(`  Inserted ${groupFormRecords.length} group forms`);

    console.log("  Phase 10 complete");
}
