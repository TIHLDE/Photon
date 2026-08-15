import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;

describe("Scheduled group forms", () => {
    integrationTest(
        "A form planned for a future date stays closed until the time passes",
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

            const opensAt = new Date(Date.now() + 2 * HOUR);

            const createResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: "index" },
                json: {
                    title: "Planlagt skjema",
                    template: false,
                    group: "index",
                    can_submit_multiple: false,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    opens_at: opensAt.toISOString(),
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
            expect(form.opens_at).toBe(opensAt.toISOString());

            // The detail endpoint answers "can I submit right now?", so a form
            // waiting for its opening time reports itself as closed.
            const detailResponse = await memberClient.api.forms[":id"].$get({
                param: { id: form.id! },
            });
            expect(detailResponse.status).toBe(200);
            const detail = await detailResponse.json();
            expect(detail.is_open_for_submissions).toBe(false);
            expect(detail.opens_at).toBe(opensAt.toISOString());

            const earlySubmit = await memberClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: form.fields?.[0]?.id! },
                            answer_text: "For tidlig",
                        },
                    ],
                },
            });
            expect(earlySubmit.status).toBe(403);

            // Members do not see the form in the group list before it opens;
            // leaders do, so they can still edit it.
            const memberListResponse = await memberClient.api.groups[
                ":slug"
            ].forms.$get({ param: { slug: "index" } });
            expect(memberListResponse.status).toBe(200);
            expect(await memberListResponse.json()).toHaveLength(0);

            const leaderListResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$get({ param: { slug: "index" } });
            const leaderList = await leaderListResponse.json();
            expect(leaderList).toHaveLength(1);
            expect(leaderList[0]?.is_open_for_submissions).toBe(true);
            expect(leaderList[0]?.is_open_now).toBe(false);
            expect(leaderList[0]?.opens_at).toBe(opensAt.toISOString());

            // Once the opening time has passed the form behaves like any other
            // open form.
            const passed = new Date(Date.now() - HOUR);
            const patchResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: { opens_at: passed.toISOString() },
            });
            expect(patchResponse.status).toBe(200);
            expect((await patchResponse.json()).opens_at).toBe(
                passed.toISOString(),
            );

            const submitResponse = await memberClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: form.fields?.[0]?.id! },
                            answer_text: "Nå går det",
                        },
                    ],
                },
            });
            expect(submitResponse.status).toBe(201);

            const openDetail = await memberClient.api.forms[":id"].$get({
                param: { id: form.id! },
            });
            expect((await openDetail.json()).is_open_for_submissions).toBe(
                true,
            );
        },
    );

    integrationTest(
        "Clearing the opening date leaves the open/closed switch in charge",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            await ctx.utils.setupGroups();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: "index",
                role: "leader",
            });

            const leaderClient = await ctx.utils.clientForUser(leader);

            const createResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: "index" },
                json: {
                    title: "Planlagt skjema",
                    template: false,
                    group: "index",
                    can_submit_multiple: true,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    opens_at: new Date(Date.now() + 2 * HOUR).toISOString(),
                    fields: [],
                },
            });
            const form = await createResponse.json();

            const patchResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: { opens_at: null },
            });

            expect(patchResponse.status).toBe(200);
            expect((await patchResponse.json()).opens_at).toBeNull();

            const detail = await leaderClient.api.forms[":id"].$get({
                param: { id: form.id! },
            });
            const body = await detail.json();
            expect(body.opens_at).toBeNull();
            expect(body.is_open_for_submissions).toBe(true);
        },
    );

    integrationTest(
        "A form with no opening date is unaffected by the schedule check",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            await ctx.utils.setupGroups();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: "index",
                role: "leader",
            });

            const leaderClient = await ctx.utils.clientForUser(leader);

            const createResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: "index" },
                json: {
                    title: "Vanlig skjema",
                    template: false,
                    group: "index",
                    can_submit_multiple: true,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    fields: [],
                },
            });

            const form = await createResponse.json();
            expect(form.opens_at).toBeNull();

            const listResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$get({ param: { slug: "index" } });
            const list = await listResponse.json();
            expect(list[0]?.is_open_now).toBe(true);
        },
    );
});
