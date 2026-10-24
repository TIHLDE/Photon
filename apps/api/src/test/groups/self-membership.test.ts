import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext as TestContext } from "~/test/config/integration";

async function interestGroupWithLeaders(
    ctx: TestContext,
    leaderCount: number,
    name = "Brettspill",
) {
    const group = await ctx.utils.createTestGroup({
        type: "INTERESTGROUP",
        name,
    });
    const leaders = [];
    for (let i = 0; i < leaderCount; i++) {
        const leader = await ctx.utils.createTestUser();
        await ctx.db.insert(schema.groupMembership).values({
            userId: leader.id,
            groupSlug: group.slug,
            role: "leader",
        });
        leaders.push(leader);
    }
    return { group, leaders };
}

async function membershipOf(ctx: TestContext, slug: string, userId: string) {
    return ctx.db.query.groupMembership.findFirst({
        where: and(
            eq(schema.groupMembership.groupSlug, slug),
            eq(schema.groupMembership.userId, userId),
        ),
    });
}

describe("asking to join an interest group", () => {
    integrationTest(
        "a request makes no membership, and every leader is notified",
        async ({ ctx }) => {
            const { group, leaders } = await interestGroupWithLeaders(ctx, 2);
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(201);
            expect(
                await membershipOf(ctx, group.slug, requester.id),
            ).toBeUndefined();

            const detail = await client.api.groups[":slug"].$get({
                param: { slug: group.slug },
            });
            expect((await detail.json()).viewerHasJoinRequest).toBe(true);

            const notifications = await ctx.db.query.notification.findMany({
                where: eq(
                    schema.notification.title,
                    "Ny forespørsel i Brettspill",
                ),
            });
            expect(notifications.map((n) => n.userId).sort()).toEqual(
                leaders.map((l) => l.id).sort(),
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
            const { group } = await interestGroupWithLeaders(ctx, 0);
            await ctx.db
                .update(schema.group)
                .set({ contactEmail: "gruppe@tihlde.org" })
                .where(eq(schema.group.slug, group.slug));
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
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
        "a group that grants its members permissions takes requests too",
        async ({ ctx }) => {
            const { group } = await interestGroupWithLeaders(ctx, 1);
            await ctx.db
                .update(schema.group)
                .set({ memberPermissions: ["events:create"] })
                .where(eq(schema.group.slug, group.slug));
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(201);
            expect(
                await membershipOf(ctx, group.slug, requester.id),
            ).toBeUndefined();
        },
        500_000,
    );

    integrationTest(
        "only interest groups take requests",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "COMMITTEE",
            });
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "asking twice, or as a member, is refused",
        async ({ ctx }) => {
            const { group, leaders } = await interestGroupWithLeaders(ctx, 1);
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            const leaderClient = await ctx.utils.clientForUser(leaders[0]!);
            const ask = () =>
                client.api.groups[":groupSlug"].join.$post({
                    param: { groupSlug: group.slug },
                });

            expect((await ask()).status).toBe(201);
            expect((await ask()).status).toBe(409);

            await leaderClient.api.groups[":groupSlug"]["join-requests"][
                ":userId"
            ].approve.$post({
                param: { groupSlug: group.slug, userId: requester.id },
            });
            expect((await ask()).status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "a request can be withdrawn",
        async ({ ctx }) => {
            const { group } = await interestGroupWithLeaders(ctx, 1);
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            const withdraw = () =>
                client.api.groups[":groupSlug"].join.$delete({
                    param: { groupSlug: group.slug },
                });

            expect((await withdraw()).status).toBe(204);
            expect((await withdraw()).status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "signing in is required",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });

            const response = await ctx.app.request(
                `/api/groups/${group.slug}/join`,
                { method: "POST" },
            );

            expect(response.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "an archived group takes no requests",
        async ({ ctx }) => {
            const { group } = await interestGroupWithLeaders(ctx, 1);
            await ctx.db
                .update(schema.group)
                .set({ archivedAt: new Date() })
                .where(eq(schema.group.slug, group.slug));
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "a failing notification neither blocks the request nor the other leaders",
        async ({ ctx }) => {
            const { group } = await interestGroupWithLeaders(ctx, 2, "Sjakk");
            const sendEmailTemplate = vi
                .spyOn(ctx.email, "sendEmailTemplate")
                .mockRejectedValueOnce(new Error("SMTP nede"));
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);

            const response = await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(201);
            expect(sendEmailTemplate).toHaveBeenCalledTimes(2);
        },
        500_000,
    );
});

describe("answering join requests", () => {
    integrationTest(
        "a leader sees the request and approves it",
        async ({ ctx }) => {
            const { group, leaders } = await interestGroupWithLeaders(ctx, 1);
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            const leaderClient = await ctx.utils.clientForUser(leaders[0]!);
            await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            const list = await leaderClient.api.groups[":groupSlug"][
                "join-requests"
            ].$get({ param: { groupSlug: group.slug } });
            expect(list.status).toBe(200);
            expect((await list.json()).map((r) => r.userId)).toEqual([
                requester.id,
            ]);

            const approve = await leaderClient.api.groups[":groupSlug"][
                "join-requests"
            ][":userId"].approve.$post({
                param: { groupSlug: group.slug, userId: requester.id },
            });

            expect(approve.status).toBe(201);
            expect(
                (await membershipOf(ctx, group.slug, requester.id))?.role,
            ).toBe("member");
            const remaining = await ctx.db.query.groupJoinRequest.findMany({
                where: eq(schema.groupJoinRequest.groupSlug, group.slug),
            });
            expect(remaining).toHaveLength(0);
            const notice = await ctx.db.query.notification.findFirst({
                where: eq(schema.notification.userId, requester.id),
            });
            expect(notice?.title).toBe("Du er med i Brettspill");
        },
        500_000,
    );

    integrationTest(
        "a declined request is gone, and the requester may ask again",
        async ({ ctx }) => {
            const { group, leaders } = await interestGroupWithLeaders(ctx, 1);
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            const leaderClient = await ctx.utils.clientForUser(leaders[0]!);
            const ask = () =>
                client.api.groups[":groupSlug"].join.$post({
                    param: { groupSlug: group.slug },
                });
            await ask();

            const decline = await leaderClient.api.groups[":groupSlug"][
                "join-requests"
            ][":userId"].decline.$post({
                param: { groupSlug: group.slug, userId: requester.id },
            });

            expect(decline.status).toBe(204);
            expect(
                await membershipOf(ctx, group.slug, requester.id),
            ).toBeUndefined();
            const notice = await ctx.db.query.notification.findFirst({
                where: eq(schema.notification.userId, requester.id),
            });
            expect(notice?.title).toBe(
                "Forespørselen til Brettspill ble avslått",
            );
            expect((await ask()).status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "an ordinary member can neither see nor answer requests",
        async ({ ctx }) => {
            const { group } = await interestGroupWithLeaders(ctx, 1);
            const requester = await ctx.utils.createTestUser();
            const member = await ctx.utils.createTestUser();
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: member.id, groupSlug: group.slug });
            const client = await ctx.utils.clientForUser(requester);
            const memberClient = await ctx.utils.clientForUser(member);
            await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            const list = await memberClient.api.groups[":groupSlug"][
                "join-requests"
            ].$get({ param: { groupSlug: group.slug } });
            const approve = await memberClient.api.groups[":groupSlug"][
                "join-requests"
            ][":userId"].approve.$post({
                param: { groupSlug: group.slug, userId: requester.id },
            });

            expect(list.status).toBe(403);
            expect(approve.status).toBe(403);
            expect(
                await membershipOf(ctx, group.slug, requester.id),
            ).toBeUndefined();
        },
        500_000,
    );

    integrationTest(
        "groups:manage can answer without being a leader",
        async ({ ctx }) => {
            const { group } = await interestGroupWithLeaders(ctx, 0);
            const requester = await ctx.utils.createTestUser();
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["groups:manage"]);
            const client = await ctx.utils.clientForUser(requester);
            const adminClient = await ctx.utils.clientForUser(admin);
            await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            const approve = await adminClient.api.groups[":groupSlug"][
                "join-requests"
            ][":userId"].approve.$post({
                param: { groupSlug: group.slug, userId: requester.id },
            });

            expect(approve.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "adding someone by hand clears their pending request",
        async ({ ctx }) => {
            const { group, leaders } = await interestGroupWithLeaders(ctx, 1);
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            const leaderClient = await ctx.utils.clientForUser(leaders[0]!);
            await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });

            await leaderClient.api.groups[":groupSlug"].members.$post({
                param: { groupSlug: group.slug },
                json: { userId: requester.id, role: "member" },
            });

            const remaining = await ctx.db.query.groupJoinRequest.findMany({
                where: eq(schema.groupJoinRequest.groupSlug, group.slug),
            });
            expect(remaining).toHaveLength(0);
        },
        500_000,
    );
});

describe("leaving an interest group", () => {
    integrationTest(
        "a member leaves on their own",
        async ({ ctx }) => {
            const { group } = await interestGroupWithLeaders(ctx, 1);
            const member = await ctx.utils.createTestUser();
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: member.id, groupSlug: group.slug });
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.groups[":groupSlug"].leave.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(204);
            expect(
                await membershipOf(ctx, group.slug, member.id),
            ).toBeUndefined();
        },
        500_000,
    );

    integrationTest(
        "a leader has to hand over before leaving",
        async ({ ctx }) => {
            const { group, leaders } = await interestGroupWithLeaders(ctx, 1);
            const client = await ctx.utils.clientForUser(leaders[0]!);

            const response = await client.api.groups[":groupSlug"].leave.$post({
                param: { groupSlug: group.slug },
            });

            expect(response.status).toBe(400);
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
        },
        500_000,
    );
});

describe("join requests waiting on me", () => {
    integrationTest(
        "a leader sees requests for the groups they lead, and no others",
        async ({ ctx }) => {
            const { group: led, leaders } = await interestGroupWithLeaders(
                ctx,
                1,
                "Brettspill",
            );
            const { group: other } = await interestGroupWithLeaders(
                ctx,
                1,
                "Sjakk",
            );
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            for (const slug of [led.slug, other.slug]) {
                await client.api.groups[":groupSlug"].join.$post({
                    param: { groupSlug: slug },
                });
            }
            const leaderClient = await ctx.utils.clientForUser(leaders[0]!);

            const response =
                await leaderClient.api.groups["join-requests"].$get();

            expect(response.status).toBe(200);
            const requests = await response.json();
            expect(requests.map((r) => r.group.name)).toEqual(["Brettspill"]);
            expect(requests[0]?.userId).toBe(requester.id);
        },
        500_000,
    );

    integrationTest(
        "groups:manage sees every group's requests",
        async ({ ctx }) => {
            const { group: first } = await interestGroupWithLeaders(ctx, 1);
            const { group: second } = await interestGroupWithLeaders(ctx, 0);
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            for (const slug of [first.slug, second.slug]) {
                await client.api.groups[":groupSlug"].join.$post({
                    param: { groupSlug: slug },
                });
            }
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["groups:manage"]);
            const adminClient = await ctx.utils.clientForUser(admin);

            const response =
                await adminClient.api.groups["join-requests"].$get();

            expect((await response.json()).length).toBe(2);
        },
        500_000,
    );

    integrationTest(
        "an ordinary member sees nothing",
        async ({ ctx }) => {
            const { group } = await interestGroupWithLeaders(ctx, 1);
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            await client.api.groups[":groupSlug"].join.$post({
                param: { groupSlug: group.slug },
            });
            const member = await ctx.utils.createTestUser();
            const memberClient = await ctx.utils.clientForUser(member);

            const response =
                await memberClient.api.groups["join-requests"].$get();

            expect(await response.json()).toEqual([]);
        },
        500_000,
    );
});
