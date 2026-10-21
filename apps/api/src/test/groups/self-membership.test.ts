import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("joining and leaving an interest group", () => {
    integrationTest(
        "a member joins on their own, and every leader is notified",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
                name: "Brettspill",
            });
            const firstLeader = await ctx.utils.createTestUser();
            const secondLeader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values([
                {
                    userId: firstLeader.id,
                    groupSlug: group.slug,
                    role: "leader",
                },
                {
                    userId: secondLeader.id,
                    groupSlug: group.slug,
                    role: "leader",
                },
            ]);
            const joiner = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(joiner);

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(201);
            const membership = await ctx.db.query.groupMembership.findFirst({
                where: and(
                    eq(schema.groupMembership.groupSlug, group.slug),
                    eq(schema.groupMembership.userId, joiner.id),
                ),
            });
            expect(membership?.role).toBe("member");

            const notifications = await ctx.db.query.notification.findMany({
                where: eq(
                    schema.notification.title,
                    "Nytt medlem i Brettspill",
                ),
            });
            expect(notifications.map((n) => n.userId).sort()).toEqual(
                [firstLeader.id, secondLeader.id].sort(),
            );
            expect(notifications[0]?.link).toBe(
                `/grupper/${group.slug}?tab=medlemmer`,
            );
        },
        500_000,
    );

    integrationTest(
        "a group without a leader is told at its contact address",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });
            await ctx.db
                .update(schema.group)
                .set({ contactEmail: "gruppe@tihlde.org" })
                .where(eq(schema.group.slug, group.slug));
            const joiner = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(joiner);
            const sendEmailTemplate = vi.spyOn(ctx.email, "sendEmailTemplate");

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(201);
            expect(
                sendEmailTemplate.mock.calls.some(
                    ([options]) => options.to === "gruppe@tihlde.org",
                ),
            ).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "a group that grants its members permissions cannot be joined",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });
            await ctx.db
                .update(schema.group)
                .set({ memberPermissions: ["events:create"] })
                .where(eq(schema.group.slug, group.slug));
            const joiner = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(joiner);

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(400);
            const detail = await client.api.groups[":slug"].$get({
                param: { slug: group.slug },
            });
            expect((await detail.json()).selfJoinable).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "only interest groups can be joined",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "COMMITTEE",
            });
            const joiner = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(joiner);

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "joining twice is refused",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });
            const joiner = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(joiner);
            const join = () =>
                client.api.groups[":groupSlug"].join.$post({
                    param: { groupSlug: group.slug },
                });

            expect((await join()).status).toBe(201);
            expect((await join()).status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "a member leaves on their own",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });
            const member = await ctx.utils.createTestUser();
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: member.id, groupSlug: group.slug });
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.groups[":groupSlug"].leave.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(204);
            const membership = await ctx.db.query.groupMembership.findFirst({
                where: eq(schema.groupMembership.userId, member.id),
            });
            expect(membership).toBeUndefined();
        },
        500_000,
    );

    integrationTest(
        "a leader has to hand over before leaving",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });
            const leader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });
            const client = await ctx.utils.clientForUser(leader);

            const response = await client.api.groups[":groupSlug"].leave.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );
    integrationTest(
        "signing in is required",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });

            const join = await ctx.app.request(
                `/api/groups/${group.slug}/join`,
                { method: "POST" },
            );
            const leave = await ctx.app.request(
                `/api/groups/${group.slug}/leave`,
                { method: "POST" },
            );

            expect(join.status).toBe(401);
            expect(leave.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "an archived group cannot be joined or left",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });
            const member = await ctx.utils.createTestUser();
            const outsider = await ctx.utils.createTestUser();
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: member.id, groupSlug: group.slug });
            await ctx.db
                .update(schema.group)
                .set({ archivedAt: new Date() })
                .where(eq(schema.group.slug, group.slug));
            const memberClient = await ctx.utils.clientForUser(member);
            const outsiderClient = await ctx.utils.clientForUser(outsider);

            const join = await outsiderClient.api.groups[
                ":groupSlug"
            ].join.$post({ param: { groupSlug: group.slug } });
            const leave = await memberClient.api.groups[
                ":groupSlug"
            ].leave.$post({ param: { groupSlug: group.slug } });

            expect(join.status).toBe(409);
            expect(leave.status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "only interest groups can be left this way",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "COMMITTEE",
            });
            const member = await ctx.utils.createTestUser();
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: member.id, groupSlug: group.slug });
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.groups[":groupSlug"].leave.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(400);
            const membership = await ctx.db.query.groupMembership.findFirst({
                where: eq(schema.groupMembership.userId, member.id),
            });
            expect(membership).toBeDefined();
        },
        500_000,
    );

    integrationTest(
        "leaving a group one is not in is a 404",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });
            const outsider = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(outsider);

            const response = await client.api.groups[":groupSlug"].leave.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "a failing notification neither blocks the join nor the other leaders",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
                name: "Sjakk",
            });
            const firstLeader = await ctx.utils.createTestUser();
            const secondLeader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values([
                {
                    userId: firstLeader.id,
                    groupSlug: group.slug,
                    role: "leader",
                },
                {
                    userId: secondLeader.id,
                    groupSlug: group.slug,
                    role: "leader",
                },
            ]);
            const sendEmailTemplate = vi
                .spyOn(ctx.email, "sendEmailTemplate")
                .mockRejectedValueOnce(new Error("SMTP nede"));
            const joiner = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(joiner);

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(201);
            expect(sendEmailTemplate).toHaveBeenCalledTimes(2);
        },
        500_000,
    );
});
