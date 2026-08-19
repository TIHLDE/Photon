import { schema } from "@photon/db";
import { env } from "@photon/core/env";
import { describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("Varsel-e-post om nytt skjemasvar", () => {
    integrationTest(
        "«Se spørreskjema» peker på svarsiden på nettsiden, ikke på API-et",
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
                    title: "Opptaksskjema",
                    template: false,
                    group: "index",
                    can_submit_multiple: false,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    email_receiver_on_submit: "opptak@tihlde.org",
                    fields: [
                        {
                            title: "Hvorfor søker du?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                    ],
                },
            });

            expect(createResponse.status).toBe(201);
            const form = await createResponse.json();

            const sendEmailTemplate = vi.spyOn(ctx.email, "sendEmailTemplate");

            const submitResponse = await memberClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: form.fields?.[0]?.id! },
                            answer_text: "Fordi det er gøy",
                        },
                    ],
                },
            });

            expect(submitResponse.status).toBe(201);

            const call = sendEmailTemplate.mock.calls.find(
                ([, template]) => template === "FormSubmissionEmail",
            );
            expect(call).toBeDefined();

            const props = call?.[2] as { formUrl: string };
            expect(props.formUrl).toBe(
                `${env.WEBSITE_URL}/sporreskjema/${form.id}/svar`,
            );
        },
    );
});
