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
        "The opening date opens the form even when the switch says closed",
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

            // Bryteren står av, men det settes et tidspunkt som har passert.
            // Å planlegge er hele beskjeden, så skjemaet lagres som åpent.
            const passed = new Date(Date.now() - HOUR);
            const createResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: "index" },
                json: {
                    title: "Planlagt, bryter av",
                    template: false,
                    group: "index",
                    can_submit_multiple: true,
                    is_open_for_submissions: false,
                    only_for_group_members: false,
                    opens_at: passed.toISOString(),
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
            const form = await createResponse.json();

            const detail = await memberClient.api.forms[":id"].$get({
                param: { id: form.id! },
            });
            expect((await detail.json()).is_open_for_submissions).toBe(true);

            const submitResponse = await memberClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: form.fields?.[0]?.id! },
                            answer_text: "Åpent nå",
                        },
                    ],
                },
            });
            expect(submitResponse.status).toBe(201);

            // Tidspunktet slo på bryteren, så den lagrede tilstanden henger
            // sammen med det skjemaet faktisk gjør.
            const listResponse = await memberClient.api.groups[
                ":slug"
            ].forms.$get({ param: { slug: "index" } });
            const list = await listResponse.json();
            expect(list[0]?.is_open_for_submissions).toBe(true);
            expect(list[0]?.is_open_now).toBe(true);
        },
    );

    integrationTest(
        "Closing a form clears its opening date, so it stays closed",
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
                    title: "Åpnet av seg selv",
                    template: false,
                    group: "index",
                    can_submit_multiple: true,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    opens_at: new Date(Date.now() - HOUR).toISOString(),
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
            const form = await createResponse.json();

            // Å stenge skjemaet skal holde det stengt: står tidspunktet igjen,
            // ville skjemaet vært åpent i samme øyeblikk det ble stengt.
            const patchResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: { is_open_for_submissions: false },
            });
            expect(patchResponse.status).toBe(200);
            expect((await patchResponse.json()).opens_at).toBeNull();

            const detail = await memberClient.api.forms[":id"].$get({
                param: { id: form.id! },
            });
            const body = await detail.json();
            expect(body.is_open_for_submissions).toBe(false);
            expect(body.opens_at).toBeNull();

            const submitResponse = await memberClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: form.fields?.[0]?.id! },
                            answer_text: "Skal ikke gå",
                        },
                    ],
                },
            });
            expect(submitResponse.status).toBe(403);
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
        "A form stops taking answers once its closing time has passed",
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

            const closesAt = new Date(Date.now() + 2 * HOUR);

            const createResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: "index" },
                json: {
                    title: "Skjema med frist",
                    template: false,
                    group: "index",
                    can_submit_multiple: true,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    closes_at: closesAt.toISOString(),
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
            expect(form.closes_at).toBe(closesAt.toISOString());

            // Fristen har ikke gått ut ennå, så skjemaet tar imot svar.
            const openDetail = await memberClient.api.forms[":id"].$get({
                param: { id: form.id! },
            });
            const openBody = await openDetail.json();
            expect(openBody.is_open_for_submissions).toBe(true);
            expect(openBody.closes_at).toBe(closesAt.toISOString());

            const inTimeSubmit = await memberClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: form.fields?.[0]?.id! },
                            answer_text: "Rakk det",
                        },
                    ],
                },
            });
            expect(inTimeSubmit.status).toBe(201);

            // Flyttes fristen bakover i tid, er skjemaet stengt — uten at noen
            // har rørt bryteren.
            const passed = new Date(Date.now() - HOUR);
            const patchResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: { closes_at: passed.toISOString() },
            });
            expect(patchResponse.status).toBe(200);
            expect((await patchResponse.json()).closes_at).toBe(
                passed.toISOString(),
            );

            const lateSubmit = await memberClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: form.fields?.[0]?.id! },
                            answer_text: "For sent",
                        },
                    ],
                },
            });
            expect(lateSubmit.status).toBe(403);

            const closedDetail = await memberClient.api.forms[":id"].$get({
                param: { id: form.id! },
            });
            expect((await closedDetail.json()).is_open_for_submissions).toBe(
                false,
            );

            // Bryteren står fortsatt på, men skjemaet tar ikke imot svar.
            const leaderList = await (
                await leaderClient.api.groups[":slug"].forms.$get({
                    param: { slug: "index" },
                })
            ).json();
            expect(leaderList[0]?.is_open_for_submissions).toBe(true);
            expect(leaderList[0]?.is_open_now).toBe(false);
            expect(leaderList[0]?.closes_at).toBe(passed.toISOString());

            // Og medlemmene ser det ikke lenger i lista.
            const memberList = await (
                await memberClient.api.groups[":slug"].forms.$get({
                    param: { slug: "index" },
                })
            ).json();
            expect(memberList).toHaveLength(0);
        },
    );

    integrationTest(
        "Reopening a form whose deadline has passed clears the deadline",
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
                    title: "Utgått frist",
                    template: false,
                    group: "index",
                    can_submit_multiple: true,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    closes_at: new Date(Date.now() - HOUR).toISOString(),
                    fields: [],
                },
            });
            const form = await createResponse.json();

            // Å slå bryteren på igjen ville ikke gjort noe med fristen liggende
            // igjen: skjemaet stengte i samme øyeblikk det ble åpnet.
            const patchResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: { is_open_for_submissions: true },
            });
            expect(patchResponse.status).toBe(200);
            expect((await patchResponse.json()).closes_at).toBeNull();

            const detail = await leaderClient.api.forms[":id"].$get({
                param: { id: form.id! },
            });
            const body = await detail.json();
            expect(body.is_open_for_submissions).toBe(true);
            expect(body.closes_at).toBeNull();
        },
    );

    integrationTest(
        "Closing a form clears its deadline along with its opening date",
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
                    title: "Åpen med frist",
                    template: false,
                    group: "index",
                    can_submit_multiple: true,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    opens_at: new Date(Date.now() - HOUR).toISOString(),
                    closes_at: new Date(Date.now() + HOUR).toISOString(),
                    fields: [],
                },
            });
            const form = await createResponse.json();

            const patchResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: { is_open_for_submissions: false },
            });
            expect(patchResponse.status).toBe(200);
            const patched = await patchResponse.json();
            expect(patched.opens_at).toBeNull();
            expect(patched.closes_at).toBeNull();
        },
    );

    integrationTest(
        "A deadline before the opening time is rejected",
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
                    title: "Stenger før det åpner",
                    template: false,
                    group: "index",
                    can_submit_multiple: true,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    opens_at: new Date(Date.now() + 2 * HOUR).toISOString(),
                    closes_at: new Date(Date.now() + HOUR).toISOString(),
                    fields: [],
                },
            });
            expect(createResponse.status).toBe(400);

            // Og det samme når fristen settes alene, mot en åpning som ligger
            // lagret fra før.
            const okResponse = await leaderClient.api.groups[
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
            const form = await okResponse.json();

            const patchResponse = await leaderClient.api.forms[":id"].$patch({
                param: { id: form.id! },
                json: { closes_at: new Date(Date.now() + HOUR).toISOString() },
            });
            expect(patchResponse.status).toBe(400);
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
