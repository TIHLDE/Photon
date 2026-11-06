import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

async function setup(ctx: IntegrationTestContext) {
    await ctx.utils.setupGroups();
    await ctx.utils.setupEventCategories();

    const group = await ctx.utils.createTestGroup({ slug: "arrangorgruppa" });
    const leader = await ctx.utils.createTestUser();
    await ctx.db
        .update(schema.group)
        .set({ leaderPermissions: ["events:update"] })
        .where(eq(schema.group.slug, group.slug));
    await ctx.db.insert(schema.groupMembership).values({
        userId: leader.id,
        groupSlug: group.slug,
        role: "leader",
    });

    const event = await ctx.utils.createTestEvent({
        organizerGroupSlug: group.slug,
    });
    const target = await ctx.utils.createTestUser();

    return {
        event,
        target,
        client: await ctx.utils.clientForUser(leader),
    };
}

async function strikesOn(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
) {
    return ctx.db.query.eventStrike.findMany({ where: { eventId, userId } });
}

describe("who an arrangør may give a prikk", () => {
    integrationTest(
        "refuses someone with no connection to the event",
        async ({ ctx }) => {
            const { event, target, client } = await setup(ctx);

            const response = await client.api.event.strikes.$post({
                json: { userId: target.id, eventId: event.id, count: 3 },
            });

            expect(response.status).toBe(409);
            expect(await strikesOn(ctx, event.id, target.id)).toEqual([]);
            expect(
                await ctx.db.query.notification.findMany({
                    where: { userId: target.id },
                }),
            ).toEqual([]);
        },
        500_000,
    );

    integrationTest(
        "accepts someone holding a spot, and tells them",
        async ({ ctx }) => {
            const { event, target, client } = await setup(ctx);
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: target.id,
                status: "attended",
            });

            const response = await client.api.event.strikes.$post({
                json: {
                    userId: target.id,
                    eventId: event.id,
                    count: 1,
                    reason: "Kom etter start",
                },
            });

            expect(response.status).toBe(201);
            const notifications = await ctx.db.query.notification.findMany({
                where: { userId: target.id },
            });
            expect(notifications).toHaveLength(1);
            expect(notifications[0]?.title).toContain("prikk");
            expect(notifications[0]?.description).toContain(event.title);
            expect(notifications[0]?.description).toContain("Kom etter start");
            expect(notifications[0]?.link).toBe(`/profil/${target.id}/prikker`);
        },
        500_000,
    );

    for (const status of ["waitlisted", "pending", "cancelled"] as const) {
        integrationTest(
            `refuses a ${status} registration, which never held a spot`,
            async ({ ctx }) => {
                const { event, target, client } = await setup(ctx);
                await ctx.db.insert(schema.eventRegistration).values({
                    eventId: event.id,
                    userId: target.id,
                    status,
                });

                const response = await client.api.event.strikes.$post({
                    json: { userId: target.id, eventId: event.id, count: 1 },
                });

                expect(response.status).toBe(409);
            },
            500_000,
        );
    }

    integrationTest(
        "adding someone first does not make them strikeable",
        async ({ ctx }) => {
            const { event, target, client } = await setup(ctx);

            const added = await client.api.event[":eventId"].registration[
                ":userId"
            ].$post({
                param: { eventId: event.id, userId: target.id },
                json: {},
            });
            expect(added.status).toBe(200);

            const response = await client.api.event.strikes.$post({
                json: { userId: target.id, eventId: event.id, count: 3 },
            });

            expect(response.status).toBe(409);
            expect(await strikesOn(ctx, event.id, target.id)).toEqual([]);
        },
        500_000,
    );

    integrationTest(
        "a strike already on the event proves nothing about having held a spot",
        async ({ ctx }) => {
            const { event, target, client } = await setup(ctx);
            await ctx.db.insert(schema.eventStrike).values({
                eventId: event.id,
                userId: target.id,
                count: 1,
                reason: "Avmelding etter avmeldingsfristen",
            });

            const response = await client.api.event.strikes.$post({
                json: { userId: target.id, eventId: event.id, count: 3 },
            });

            expect(response.status).toBe(409);
            expect(await strikesOn(ctx, event.id, target.id)).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "someone added who leaves late cannot then be given more by the arrangør",
        async ({ ctx }) => {
            const { event, target, client } = await setup(ctx);
            await ctx.db
                .update(schema.event)
                .set({
                    canCauseStrikes: true,
                    cancellationDeadline: new Date(Date.now() - 60_000),
                })
                .where(eq(schema.event.id, event.id));
            await client.api.event[":eventId"].registration[":userId"].$post({
                param: { eventId: event.id, userId: target.id },
                json: {},
            });

            const targetClient = await ctx.utils.clientForUser(target);
            const left = await targetClient.api.event[
                ":eventId"
            ].registration.$delete({ param: { eventId: event.id } });
            expect(left.status).toBe(200);

            const response = await client.api.event.strikes.$post({
                json: { userId: target.id, eventId: event.id, count: 3 },
            });
            expect(response.status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "leaving late through the real route still gives the automatic prikk, and the row is gone",
        async ({ ctx }) => {
            const { event, target } = await setup(ctx);
            await ctx.db
                .update(schema.event)
                .set({
                    canCauseStrikes: true,
                    cancellationDeadline: new Date(Date.now() - 60_000),
                })
                .where(eq(schema.event.id, event.id));
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: target.id,
                status: "registered",
            });

            const targetClient = await ctx.utils.clientForUser(target);
            const left = await targetClient.api.event[
                ":eventId"
            ].registration.$delete({ param: { eventId: event.id } });
            expect(left.status).toBe(200);

            expect(
                await ctx.db.query.eventRegistration.findFirst({
                    where: { eventId: event.id, userId: target.id },
                }),
            ).toBeUndefined();
            expect(await strikesOn(ctx, event.id, target.id)).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "events:strikes:create across TIHLDE is not bound to a registration",
        async ({ ctx }) => {
            const { event, target } = await setup(ctx);
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, [
                "events:strikes:create",
            ]);
            const adminClient = await ctx.utils.clientForUser(admin);

            const response = await adminClient.api.event.strikes.$post({
                json: { userId: target.id, eventId: event.id, count: 1 },
            });

            expect(response.status).toBe(201);
            expect(
                await ctx.db.query.notification.findMany({
                    where: { userId: target.id },
                }),
            ).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "arranging events across TIHLDE is not the same as the strike permission",
        async ({ ctx }) => {
            const { event, target } = await setup(ctx);
            const arranger = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(arranger, ["events:update"]);
            const arrangerClient = await ctx.utils.clientForUser(arranger);

            const response = await arrangerClient.api.event.strikes.$post({
                json: { userId: target.id, eventId: event.id, count: 1 },
            });

            expect(response.status).toBe(409);
        },
        500_000,
    );
});
