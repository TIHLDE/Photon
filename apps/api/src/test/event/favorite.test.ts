import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("event favorites", () => {
    integrationTest(
        "only returns the favorites of the authenticated user",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const eventA = await ctx.utils.createTestEvent({
                title: "Event A",
                slug: `event-a-${Date.now()}`,
            });
            const eventB = await ctx.utils.createTestEvent({
                title: "Event B",
                slug: `event-b-${Date.now()}`,
            });

            const userA = await ctx.utils.createTestUser();
            const userB = await ctx.utils.createTestUser();
            const clientA = await ctx.utils.clientForUser(userA);
            const clientB = await ctx.utils.clientForUser(userB);

            const favoriteA = await clientA.api.event.favorite[":id"].$put({
                param: { id: eventA.id },
                json: { isFavorite: true },
            });
            expect(favoriteA.status).toBe(200);

            const favoriteB = await clientB.api.event.favorite[":id"].$put({
                param: { id: eventB.id },
                json: { isFavorite: true },
            });
            expect(favoriteB.status).toBe(200);

            const responseA = await clientA.api.event.favorite.$get();
            expect(responseA.status).toBe(200);
            const bodyA = await responseA.json();

            expect(bodyA.map((f) => f.eventId)).toEqual([eventA.id]);

            const responseB = await clientB.api.event.favorite.$get();
            expect(responseB.status).toBe(200);
            const bodyB = await responseB.json();

            expect(bodyB.map((f) => f.eventId)).toEqual([eventB.id]);
        },
        500_000,
    );
});
