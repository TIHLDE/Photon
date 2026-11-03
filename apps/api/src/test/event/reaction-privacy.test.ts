import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

async function eventWithReaction(ctx: IntegrationTestContext) {
    await ctx.utils.setupGroups();
    await ctx.utils.setupEventCategories();
    const event = await ctx.utils.createTestEvent({
        slug: `reaction-privacy-${crypto.randomUUID()}`,
    });
    const reactor = await ctx.utils.createTestUser();
    await ctx.db
        .insert(schema.eventReaction)
        .values({ eventId: event.id, userId: reactor.id, emoji: "👍" });

    return { event, reactor };
}

describe("GET /api/event/:eventId — who reacted", () => {
    integrationTest("a signed-out visitor is not told", async ({ ctx }) => {
        const { event, reactor } = await eventWithReaction(ctx);

        const res = await ctx.app.request(`/api/event/${event.id}`);

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain(reactor.id);
        expect(text).not.toContain(reactor.name);
        expect(JSON.parse(text).reactions).toEqual([]);
    });

    integrationTest(
        "an account awaiting approval is not told",
        async ({ ctx }) => {
            const { event } = await eventWithReaction(ctx);
            const viewer = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ approvalStatus: "pending" })
                .where(eq(schema.user.id, viewer.id));
            const client = await ctx.utils.clientForUser(viewer);

            const res = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            const body = await res.json();
            if (typeof body === "string") throw new Error(body);

            expect(body.reactions).toEqual([]);
        },
    );

    integrationTest("a member still is", async ({ ctx }) => {
        const { event, reactor } = await eventWithReaction(ctx);
        const viewer = await ctx.utils.createTestUser();
        const client = await ctx.utils.clientForUser(viewer);

        const res = await client.api.event[":eventId"].$get({
            param: { eventId: event.id },
        });
        const body = await res.json();
        if (typeof body === "string") throw new Error(body);

        expect(body.reactions.map((reaction) => reaction.user.id)).toEqual([
            reactor.id,
        ]);
    });
});
