import type { EmailQueueJobData } from "@photon/core/services/email";
import { EMAIL_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

const GROUP = "biljard";
const APPLICATION = {
    name: "Medlem Test",
    message: "Jeg spiller biljard hver uke.",
};

async function setup(ctx: IntegrationTestContext) {
    await ctx.utils.setupGroups();
    const leader = await ctx.utils.createTestUser();
    const applicant = await ctx.utils.createTestUser();
    await ctx.db
        .insert(schema.groupMembership)
        .values({ userId: leader.id, groupSlug: GROUP, role: "leader" });
    await ctx.db
        .update(schema.group)
        .set({ acceptsJoinRequests: true })
        .where(eq(schema.group.slug, GROUP));
    return {
        leader,
        applicant,
        leaderClient: await ctx.utils.clientForUser(leader),
        applicantClient: await ctx.utils.clientForUser(applicant),
    };
}

async function notificationTitles(ctx: IntegrationTestContext, userId: string) {
    const rows = await ctx.db
        .select({ title: schema.notification.title })
        .from(schema.notification)
        .where(eq(schema.notification.userId, userId));
    return rows.map((row) => row.title);
}

describe("Join requests for interest groups", () => {
    integrationTest(
        "A member applies, the leader is notified and approves",
        async ({ ctx }) => {
            const { leader, applicant, leaderClient, applicantClient } =
                await setup(ctx);
            const groupApi = applicantClient.api.groups[":slug"];
            const requestsApi =
                applicantClient.api.groups[":groupSlug"]["join-requests"];

            const before = await (
                await groupApi.$get({ param: { slug: GROUP } })
            ).json();
            expect(before.viewerCanRequestToJoin).toBe(true);

            const created = await requestsApi.$post({
                param: { groupSlug: GROUP },
                json: APPLICATION,
            });
            expect(created.status).toBe(201);

            const again = await requestsApi.$post({
                param: { groupSlug: GROUP },
                json: APPLICATION,
            });
            expect(again.status).toBe(409);

            const pending = await (
                await groupApi.$get({ param: { slug: GROUP } })
            ).json();
            expect(pending.viewerHasPendingJoinRequest).toBe(true);
            expect(pending.viewerCanRequestToJoin).toBe(false);

            expect(await notificationTitles(ctx, leader.id)).toEqual([
                "Ny søknad til TIHLDE Biljard",
            ]);
            expect(await notificationTitles(ctx, applicant.id)).toEqual([
                "Du har bedt om å bli med i TIHLDE Biljard",
            ]);
            const emails = await ctx.queue
                .getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME)
                .getJobs(["waiting", "active"]);
            expect(emails.map((job) => job.data.options.to).sort()).toEqual(
                [leader.email, applicant.email].sort(),
            );

            const list = await leaderClient.api.groups[":groupSlug"][
                "join-requests"
            ].$get({ param: { groupSlug: GROUP } });
            expect(list.status).toBe(200);
            const requests = await list.json();
            expect(requests).toHaveLength(1);
            expect(requests[0]).toMatchObject({
                user: { id: applicant.id },
                ...APPLICATION,
            });
            const [leaderNotification] = await ctx.db
                .select({ description: schema.notification.description })
                .from(schema.notification)
                .where(eq(schema.notification.userId, leader.id));
            expect(leaderNotification?.description).toContain(
                APPLICATION.message,
            );

            const approved = await leaderClient.api.groups[":groupSlug"][
                "join-requests"
            ][":requestId"].$patch({
                param: { groupSlug: GROUP, requestId: requests[0]!.id },
                json: { status: "approved" },
            });
            expect(approved.status).toBe(200);

            const membership = await ctx.db.query.groupMembership.findFirst({
                where: and(
                    eq(schema.groupMembership.userId, applicant.id),
                    eq(schema.groupMembership.groupSlug, GROUP),
                ),
            });
            expect(membership?.role).toBe("member");
            expect(await notificationTitles(ctx, applicant.id)).toContain(
                "Gratulerer! Du er nå medlem i TIHLDE Biljard",
            );

            const after = await leaderClient.api.groups[":groupSlug"][
                "join-requests"
            ].$get({ param: { groupSlug: GROUP } });
            expect(await after.json()).toEqual([]);

            const member = await requestsApi.$post({
                param: { groupSlug: GROUP },
                json: APPLICATION,
            });
            expect(member.status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "A rejected member is told and may apply again",
        async ({ ctx }) => {
            const { applicant, leaderClient, applicantClient } =
                await setup(ctx);
            const requestsApi =
                applicantClient.api.groups[":groupSlug"]["join-requests"];

            const created = await (
                await requestsApi.$post({
                    param: { groupSlug: GROUP },
                    json: APPLICATION,
                })
            ).json();

            const rejected = await leaderClient.api.groups[":groupSlug"][
                "join-requests"
            ][":requestId"].$patch({
                param: { groupSlug: GROUP, requestId: created.id },
                json: { status: "rejected" },
            });
            expect(rejected.status).toBe(200);

            expect(await notificationTitles(ctx, applicant.id)).toContain(
                "Søknaden din ble dessverre avvist",
            );
            const membership = await ctx.db.query.groupMembership.findFirst({
                where: eq(schema.groupMembership.userId, applicant.id),
            });
            expect(membership).toBeUndefined();

            const reapplied = await requestsApi.$post({
                param: { groupSlug: GROUP },
                json: APPLICATION,
            });
            expect(reapplied.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "Only interest groups that take requests, and only signed-in members",
        async ({ ctx }) => {
            const { applicantClient } = await setup(ctx);
            const requestsApi =
                applicantClient.api.groups[":groupSlug"]["join-requests"];

            const committee = await requestsApi.$post({
                param: { groupSlug: "index" },
                json: APPLICATION,
            });
            expect(committee.status).toBe(400);

            const empty = await requestsApi.$post({
                param: { groupSlug: GROUP },
                json: { name: " ", message: "" },
            });
            expect(empty.status).toBe(400);

            const offByDefault = await requestsApi.$post({
                param: { groupSlug: "basket" },
                json: APPLICATION,
            });
            expect(offByDefault.status).toBe(400);

            const signedOut = await ctx.utils
                .client()
                .api.groups[":groupSlug"]["join-requests"].$post({
                    param: { groupSlug: GROUP },
                    json: APPLICATION,
                });
            expect(signedOut.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "Only the group's leaders and admins see and handle requests, once",
        async ({ ctx }) => {
            const { applicantClient } = await setup(ctx);
            const created = await (
                await applicantClient.api.groups[":groupSlug"][
                    "join-requests"
                ].$post({ param: { groupSlug: GROUP }, json: APPLICATION })
            ).json();

            const member = await ctx.utils.createTestUser();
            const otherLeader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values([
                { userId: member.id, groupSlug: GROUP, role: "member" },
                { userId: otherLeader.id, groupSlug: "index", role: "leader" },
            ]);
            for (const outsider of [member, otherLeader]) {
                const client = await ctx.utils.clientForUser(outsider);
                const api = client.api.groups[":groupSlug"]["join-requests"];
                const list = await api.$get({ param: { groupSlug: GROUP } });
                expect(list.status).toBe(403);
                const handle = await api[":requestId"].$patch({
                    param: { groupSlug: GROUP, requestId: created.id },
                    json: { status: "approved" },
                });
                expect(handle.status).toBe(403);
            }

            const admins = await Promise.all([
                ctx.utils.createTestUser(),
                ctx.utils.createTestUser(),
            ]);
            const responses = await Promise.all(
                admins.map(async (admin) => {
                    await ctx.utils.giveUserPermissions(admin, [
                        "groups:manage",
                    ]);
                    const client = await ctx.utils.clientForUser(admin);
                    return client.api.groups[":groupSlug"]["join-requests"][
                        ":requestId"
                    ].$patch({
                        param: { groupSlug: GROUP, requestId: created.id },
                        json: { status: "approved" },
                    });
                }),
            );
            const statuses: number[] = responses.map((r) => r.status);
            expect(statuses.sort()).toEqual([200, 404]);
        },
        500_000,
    );
});
