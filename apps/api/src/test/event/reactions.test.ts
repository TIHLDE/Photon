import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("event reactions", () => {
    integrationTest(
        "event detail says whether reactions are allowed",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const allowed = await ctx.utils.createTestEvent({
                slug: `reactions-on-${Date.now()}`,
                reactionsAllowed: true,
            });
            const disallowed = await ctx.utils.createTestEvent({
                slug: `reactions-off-${Date.now()}`,
                reactionsAllowed: false,
            });

            const client = ctx.utils.client();

            const allowedResponse = await client.api.event[":eventId"].$get({
                param: { eventId: allowed.id },
            });
            expect(allowedResponse.status).toBe(200);
            const allowedBody = await allowedResponse.json();
            if (typeof allowedBody === "string") throw new Error(allowedBody);
            expect(allowedBody.reactionsAllowed).toBe(true);

            const disallowedResponse = await client.api.event[":eventId"].$get({
                param: { eventId: disallowed.id },
            });
            expect(disallowedResponse.status).toBe(200);
            const disallowedBody = await disallowedResponse.json();
            if (typeof disallowedBody === "string") {
                throw new Error(disallowedBody);
            }
            expect(disallowedBody.reactionsAllowed).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "a member can add, replace and remove their reaction",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `reactions-${Date.now()}`,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ image: "avatars/test.png" })
                .where(eq(schema.user.id, user.id));
            const client = await ctx.utils.clientForUser(user);

            // Add
            const createResponse = await client.api.event[
                ":eventId"
            ].reactions.$post({
                param: { eventId: event.id },
                json: { emoji: "👍" },
            });
            expect(createResponse.status).toBe(201);
            const created = await createResponse.json();
            expect(created.emoji).toBe("👍");
            expect(created.userId).toBe(user.id);
            expect(created.eventId).toBe(event.id);

            const afterCreate = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            const afterCreateBody = await afterCreate.json();
            if (typeof afterCreateBody === "string") {
                throw new Error(afterCreateBody);
            }
            expect(afterCreateBody.reactions).toEqual([
                {
                    emoji: "👍",
                    user: {
                        id: user.id,
                        name: user.name,
                        image: "avatars/test.png",
                    },
                },
            ]);

            // Replace — still exactly one reaction
            const replaceResponse = await client.api.event[
                ":eventId"
            ].reactions.$post({
                param: { eventId: event.id },
                json: { emoji: "❤️" },
            });
            expect(replaceResponse.status).toBe(201);
            expect((await replaceResponse.json()).emoji).toBe("❤️");

            const afterReplace = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            const afterReplaceBody = await afterReplace.json();
            if (typeof afterReplaceBody === "string") {
                throw new Error(afterReplaceBody);
            }
            expect(afterReplaceBody.reactions).toHaveLength(1);
            expect(afterReplaceBody.reactions[0]?.emoji).toBe("❤️");

            // Remove
            const deleteResponse = await client.api.event[
                ":eventId"
            ].reactions.$delete({
                param: { eventId: event.id },
            });
            expect(deleteResponse.status).toBe(200);

            const afterDelete = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            const afterDeleteBody = await afterDelete.json();
            if (typeof afterDeleteBody === "string") {
                throw new Error(afterDeleteBody);
            }
            expect(afterDeleteBody.reactions).toHaveLength(0);

            // Removing again — there is nothing to remove
            const secondDelete = await client.api.event[
                ":eventId"
            ].reactions.$delete({
                param: { eventId: event.id },
            });
            expect(secondDelete.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "reacting is forbidden when the event has reactions turned off",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `reactions-off-${Date.now()}`,
                reactionsAllowed: false,
            });

            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.event[":eventId"].reactions.$post(
                {
                    param: { eventId: event.id },
                    json: { emoji: "👍" },
                },
            );
            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "reacting requires being signed in",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `reactions-anon-${Date.now()}`,
            });

            const anonClient = ctx.utils.client();

            const createResponse = await anonClient.api.event[
                ":eventId"
            ].reactions.$post({
                param: { eventId: event.id },
                json: { emoji: "👍" },
            });
            expect(createResponse.status).toBe(401);

            const deleteResponse = await anonClient.api.event[
                ":eventId"
            ].reactions.$delete({
                param: { eventId: event.id },
            });
            expect(deleteResponse.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "a non-member cannot react to a members-only event",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `reactions-members-${Date.now()}`,
                visibility: "members",
            });

            // Not a member yet: the account waits for an admin's approval.
            // requireAuth turns those away before the route looks at the
            // event, so the answer is 403 rather than the detail route's 404.
            const pending = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ approvalStatus: "pending" })
                .where(eq(schema.user.id, pending.id));
            const client = await ctx.utils.clientForUser(pending);

            const response = await client.api.event[":eventId"].reactions.$post(
                {
                    param: { eventId: event.id },
                    json: { emoji: "👍" },
                },
            );
            expect(response.status).toBe(403);

            const reactions = await ctx.db
                .select()
                .from(schema.eventReaction)
                .where(eq(schema.eventReaction.eventId, event.id));
            expect(reactions).toHaveLength(0);
        },
        500_000,
    );
});
