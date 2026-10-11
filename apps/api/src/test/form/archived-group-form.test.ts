import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("Forms of an archived group", () => {
    integrationTest(
        "An open form stops taking answers while its group is archived",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const member = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup({
                slug: "archived-form-group",
            });

            await ctx.db.insert(schema.groupMembership).values([
                { userId: leader.id, groupSlug: group.slug, role: "leader" },
                { userId: member.id, groupSlug: group.slug, role: "member" },
            ]);

            const leaderClient = await ctx.utils.clientForUser(leader);
            const memberClient = await ctx.utils.clientForUser(member);

            const createResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: group.slug },
                json: {
                    title: "Åpent skjema",
                    template: false,
                    group: group.slug,
                    can_submit_multiple: true,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    fields: [
                        {
                            title: "Hva synes du?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                    ],
                },
            });
            expect(createResponse.status).toBe(201);
            const form = await createResponse.json();

            const submit = () =>
                memberClient.api.forms[":formId"].submissions.$post({
                    param: { formId: form.id! },
                    json: {
                        answers: [
                            {
                                field: { id: form.fields?.[0]?.id! },
                                answer_text: "Svar",
                            },
                        ],
                    },
                });
            const isOpen = async () => {
                const detail = await memberClient.api.forms[":id"].$get({
                    param: { id: form.id! },
                });
                return (await detail.json()).is_open_for_submissions;
            };
            const setArchived = (archivedAt: Date | null) =>
                ctx.db
                    .update(schema.group)
                    .set({ archivedAt })
                    .where(eq(schema.group.slug, group.slug));

            expect(await isOpen()).toBe(true);
            expect((await submit()).status).toBe(201);

            await setArchived(new Date());
            expect(await isOpen()).toBe(false);
            expect((await submit()).status).toBe(403);

            const list = await memberClient.api.groups[":slug"].forms.$get({
                param: { slug: group.slug },
            });
            const listed = await list.json();
            expect(listed.every((f) => !f.is_open_now)).toBe(true);

            await setArchived(null);
            expect(await isOpen()).toBe(true);
            expect((await submit()).status).toBe(201);
        },
        500_000,
    );
});
