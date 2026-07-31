import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("notification list", () => {
    integrationTest(
        "filters on read state and counts unread without fetching them",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.db.insert(schema.notification).values([
                {
                    userId: user.id,
                    title: "Ulest 1",
                    description: "",
                    isRead: false,
                },
                {
                    userId: user.id,
                    title: "Ulest 2",
                    description: "",
                    isRead: false,
                },
                {
                    userId: user.id,
                    title: "Lest",
                    description: "",
                    isRead: true,
                },
            ]);

            const all = await client.api.notification.$get({ query: {} });
            expect(all.status).toBe(200);
            expect((await all.json()).totalCount).toBe(3);

            /**
             * The profile badge asks for a single row and reads totalCount, so
             * the count must reflect the filter and not the page size. A
             * `z.coerce.boolean()` query param would read "false" as true and
             * make this return the read one instead.
             */
            const unread = await client.api.notification.$get({
                query: { isRead: "false", pageSize: "1" },
            });
            const unreadBody = await unread.json();
            expect(unreadBody.totalCount).toBe(2);
            expect(unreadBody.items).toHaveLength(1);
            expect(unreadBody.items[0]?.isRead).toBe(false);

            const read = await client.api.notification.$get({
                query: { isRead: "true" },
            });
            const readBody = await read.json();
            expect(readBody.totalCount).toBe(1);
            expect(readBody.items[0]?.title).toBe("Lest");
        },
    );

    integrationTest(
        "counts only the caller's notifications",
        async ({ ctx }) => {
            const mine = await ctx.utils.createTestUser();
            const theirs = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(mine);

            await ctx.db.insert(schema.notification).values([
                {
                    userId: theirs.id,
                    title: "Ikke min",
                    description: "",
                    isRead: false,
                },
            ]);

            const unread = await client.api.notification.$get({
                query: { isRead: "false" },
            });
            expect((await unread.json()).totalCount).toBe(0);
        },
    );
});
