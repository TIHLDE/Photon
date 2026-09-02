import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("Delete all form submissions", () => {
    integrationTest("deletes every submission for a form", async ({ ctx }) => {
        const leader = await ctx.utils.createTestUser();
        const firstSubmitter = await ctx.utils.createTestUser();
        const secondSubmitter = await ctx.utils.createTestUser();

        await ctx.utils.setupGroups();
        await ctx.db.insert(schema.groupMembership).values({
            userId: leader.id,
            groupSlug: "index",
            role: "leader",
        });

        const leaderClient = await ctx.utils.clientForUser(leader);
        const createResponse = await leaderClient.api.groups[":slug"].forms.$post(
            {
                param: { slug: "index" },
                json: {
                    title: "Slettetest",
                    template: false,
                    group: "index",
                    can_submit_multiple: true,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    fields: [
                        {
                            title: "Svar",
                            type: "text_answer",
                            required: false,
                            order: 0,
                        },
                    ],
                },
            },
        );
        expect(createResponse.status).toBe(201);
        const form = await createResponse.json();
        const field = form.fields?.[0];
        expect(field).toBeDefined();

        for (const [user, answer] of [
            [firstSubmitter, "første"] as const,
            [secondSubmitter, "andre"] as const,
        ]) {
            const submitterClient = await ctx.utils.clientForUser(user);
            const response = await submitterClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: field?.id as string },
                            answer_text: answer,
                        },
                    ],
                },
            });
            expect(response.status).toBe(201);
        }

        const before = await leaderClient.api.forms[":formId"].submissions.$get(
            { param: { formId: form.id! } },
        );
        expect(await before.json()).toHaveLength(2);

        const deleteResponse = await leaderClient.api.forms[
            ":formId"
        ].submissions.$delete({ param: { formId: form.id! } });
        expect(deleteResponse.status).toBe(200);

        const after = await leaderClient.api.forms[":formId"].submissions.$get(
            { param: { formId: form.id! } },
        );
        expect(await after.json()).toHaveLength(0);
    });
});
