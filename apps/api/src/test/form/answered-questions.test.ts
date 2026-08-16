import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Et gruppeskjema med svar er ikke frosset. Det som stoppes er endringene som
 * ville tatt svar med seg — å fjerne et besvart spørsmål eller alternativ, og
 * å bytte type på et besvart spørsmål. Resten, inkludert å stenge skjemaet,
 * skal gå gjennom med svarene i behold.
 */
describe("Editing a group form that has answers", () => {
    integrationTest(
        "Closing the form and renaming questions keeps the submissions",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const member = await ctx.utils.createTestUser();

            await ctx.utils.setupGroups();
            await ctx.db.insert(schema.groupMembership).values([
                { userId: leader.id, groupSlug: "index", role: "leader" },
                { userId: member.id, groupSlug: "index", role: "member" },
            ]);

            const leaderClient = await ctx.utils.clientForUser(leader);
            const memberClient = await ctx.utils.clientForUser(member);

            const createResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: "index" },
                json: {
                    title: "Påmelding",
                    template: false,
                    group: "index",
                    can_submit_multiple: false,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    fields: [
                        {
                            title: "Hva heter du?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                        {
                            title: "Allergier?",
                            type: "single_select",
                            required: false,
                            order: 1,
                            options: [
                                { title: "Ingen", order: 0 },
                                { title: "Nøtter", order: 1 },
                            ],
                        },
                    ],
                },
            });
            expect(createResponse.status).toBe(201);
            const form = await createResponse.json();
            const textField = form.fields?.[0]!;
            const selectField = form.fields?.[1]!;

            const submitResponse = await memberClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: textField.id },
                            answer_text: "Kari",
                        },
                        {
                            field: { id: selectField.id },
                            selected_options: [
                                { id: selectField.options?.[1]?.id! },
                            ],
                        },
                    ],
                },
            });
            expect(submitResponse.status).toBe(201);

            // Å stenge skjemaet er ikke en endring av spørsmålene, og går
            // gjennom selv om spørsmålene sendes med uendret.
            const closeResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: {
                    is_open_for_submissions: false,
                    fields: [
                        {
                            id: textField.id,
                            title: "Hva heter du?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                        {
                            id: selectField.id,
                            title: "Allergier?",
                            type: "single_select",
                            required: false,
                            order: 1,
                            options: [
                                {
                                    id: selectField.options?.[0]?.id!,
                                    title: "Ingen",
                                    order: 0,
                                },
                                {
                                    id: selectField.options?.[1]?.id!,
                                    title: "Nøtter",
                                    order: 1,
                                },
                            ],
                        },
                    ],
                },
            });
            expect(closeResponse.status).toBe(200);
            expect((await closeResponse.json()).is_open_for_submissions).toBe(
                false,
            );

            // Skrivefeil kan rettes, rekkefølgen endres, og nye spørsmål og
            // alternativer legges til.
            const editResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: {
                    fields: [
                        {
                            id: selectField.id,
                            title: "Har du allergier?",
                            type: "single_select",
                            required: true,
                            order: 0,
                            options: [
                                {
                                    id: selectField.options?.[0]?.id!,
                                    title: "Ingen allergier",
                                    order: 0,
                                },
                                {
                                    id: selectField.options?.[1]?.id!,
                                    title: "Nøtter",
                                    order: 1,
                                },
                                { title: "Melk", order: 2 },
                            ],
                        },
                        {
                            id: textField.id,
                            title: "Navn",
                            type: "text_answer",
                            required: true,
                            order: 1,
                        },
                        {
                            title: "Kommentar",
                            type: "text_answer",
                            required: false,
                            order: 2,
                        },
                    ],
                },
            });
            expect(editResponse.status).toBe(200);
            const edited = await editResponse.json();
            expect(edited.fields?.map((f) => f.title)).toEqual([
                "Har du allergier?",
                "Navn",
                "Kommentar",
            ]);

            // Svaret står igjen, med teksten og alternativet det ble sendt inn
            // med — spørsmålene beholdt id-ene sine.
            const submissionsResponse = await leaderClient.api.forms[
                ":formId"
            ].submissions.$get({ param: { formId: form.id! } });
            expect(submissionsResponse.status).toBe(200);
            const submissions = await submissionsResponse.json();
            expect(submissions).toHaveLength(1);
            const answers = submissions[0]?.answers ?? [];
            expect(answers).toHaveLength(2);
            expect(
                answers.find((a) => a.field_id === textField.id)?.answer_text,
            ).toBe("Kari");
            expect(
                answers.find((a) => a.field_id === selectField.id)
                    ?.selected_options?.[0]?.title,
            ).toBe("Nøtter");
        },
    );

    integrationTest(
        "Removing an answered question, option, or changing its type is rejected",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const member = await ctx.utils.createTestUser();

            await ctx.utils.setupGroups();
            await ctx.db.insert(schema.groupMembership).values([
                { userId: leader.id, groupSlug: "index", role: "leader" },
                { userId: member.id, groupSlug: "index", role: "member" },
            ]);

            const leaderClient = await ctx.utils.clientForUser(leader);
            const memberClient = await ctx.utils.clientForUser(member);

            const createResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: "index" },
                json: {
                    title: "Påmelding",
                    template: false,
                    group: "index",
                    can_submit_multiple: false,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    fields: [
                        {
                            title: "Allergier?",
                            type: "single_select",
                            required: false,
                            order: 0,
                            options: [
                                { title: "Ingen", order: 0 },
                                { title: "Nøtter", order: 1 },
                            ],
                        },
                        {
                            title: "Ubesvart spørsmål",
                            type: "text_answer",
                            required: false,
                            order: 1,
                        },
                    ],
                },
            });
            expect(createResponse.status).toBe(201);
            const form = await createResponse.json();
            const selectField = form.fields?.[0]!;
            const unansweredField = form.fields?.[1]!;
            const chosenOption = selectField.options?.[1]!;

            const submitResponse = await memberClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: selectField.id },
                            selected_options: [{ id: chosenOption.id }],
                        },
                    ],
                },
            });
            expect(submitResponse.status).toBe(201);

            const keepSelectField = {
                id: selectField.id,
                title: "Allergier?",
                type: "single_select" as const,
                required: false,
                order: 0,
                options: [
                    {
                        id: selectField.options?.[0]?.id!,
                        title: "Ingen",
                        order: 0,
                    },
                    { id: chosenOption.id, title: "Nøtter", order: 1 },
                ],
            };

            // Spørsmålet noen har svart på er fjernet.
            const removeField = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: { fields: [] },
            });
            expect(removeField.status).toBe(409);

            // Alternativet noen har valgt er fjernet.
            const removeOption = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: {
                    fields: [
                        {
                            ...keepSelectField,
                            options: [
                                {
                                    id: selectField.options?.[0]?.id!,
                                    title: "Ingen",
                                    order: 0,
                                },
                            ],
                        },
                    ],
                },
            });
            expect(removeOption.status).toBe(409);

            // Typen på et besvart spørsmål er byttet.
            const changeType = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: {
                    fields: [
                        {
                            id: selectField.id,
                            title: "Allergier?",
                            type: "text_answer",
                            required: false,
                            order: 0,
                        },
                    ],
                },
            });
            expect(changeType.status).toBe(409);

            // Ingen av avvisningene skrev noe: spørsmålene og svaret står som
            // før.
            const detail = await leaderClient.api.forms[":id"].$get({
                param: { id: form.id! },
            });
            expect((await detail.json()).fields).toHaveLength(2);

            // Et spørsmål ingen har svart på kan fortsatt fjernes.
            const removeUnanswered = await leaderClient.api.forms[":id"].$patch(
                {
                    param: { id: form.id! },
                    json: { fields: [keepSelectField] },
                },
            );
            expect(removeUnanswered.status).toBe(200);
            const remaining = await removeUnanswered.json();
            expect(remaining.fields).toHaveLength(1);
            expect(remaining.fields?.[0]?.id).toBe(selectField.id);
            expect(unansweredField.id).not.toBe(selectField.id);

            const submissionsResponse = await leaderClient.api.forms[
                ":formId"
            ].submissions.$get({ param: { formId: form.id! } });
            const submissions = await submissionsResponse.json();
            expect(submissions).toHaveLength(1);
            expect(
                submissions[0]?.answers?.[0]?.selected_options?.[0]?.title,
            ).toBe("Nøtter");
        },
    );
});
