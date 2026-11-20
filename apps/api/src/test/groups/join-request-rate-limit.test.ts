import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

const JOIN_REQUEST_LIMIT = 10;

describe("rate limit on join requests", () => {
    integrationTest(
        "asking and withdrawing in a loop stops notifying the leaders",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
                name: "Brettspill",
            });
            const leader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });

            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            const param = { groupSlug: group.slug };

            for (let i = 0; i < JOIN_REQUEST_LIMIT; i++) {
                const asked = await client.api.groups[":groupSlug"].join.$post({
                    param,
                });
                expect(asked.status).toBe(201);
                const withdrawn = await client.api.groups[
                    ":groupSlug"
                ].join.$delete({ param });
                expect(withdrawn.status).toBe(204);
            }

            const blocked = await client.api.groups[":groupSlug"].join.$post({
                param,
            });
            expect(blocked.status).toBe(429);

            const notifications = await ctx.db.query.notification.findMany({
                where: { userId: leader.id },
            });
            expect(notifications).toHaveLength(JOIN_REQUEST_LIMIT);

            const other = await ctx.utils.createTestUser();
            const otherClient = await ctx.utils.clientForUser(other);
            const otherAsked = await otherClient.api.groups[
                ":groupSlug"
            ].join.$post({ param });
            expect(otherAsked.status).toBe(201);
        },
    );

    integrationTest(
        "a refused request does not use up the limit",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
                name: "Brettspill",
            });
            const requester = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(requester);
            const param = { groupSlug: group.slug };

            const first = await client.api.groups[":groupSlug"].join.$post({
                param,
            });
            expect(first.status).toBe(201);

            for (let i = 0; i < JOIN_REQUEST_LIMIT; i++) {
                const repeat = await client.api.groups[":groupSlug"].join.$post(
                    { param },
                );
                expect(repeat.status).toBe(409);
            }

            await client.api.groups[":groupSlug"].join.$delete({ param });
            const again = await client.api.groups[":groupSlug"].join.$post({
                param,
            });
            expect(again.status).toBe(201);
        },
    );
});
