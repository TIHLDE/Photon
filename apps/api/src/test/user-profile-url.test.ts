import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

integrationTest(
    "gets a profile by username while keeping ID lookup working",
    async ({ ctx }) => {
        const target = await ctx.utils.createTestUser();
        const client = await ctx.utils.clientForUser(target);
        const username = target.email.replace(/@.*/, "");

        await ctx.db
            .update(schema.user)
            .set({ username })
            .where(eq(schema.user.id, target.id));

        for (const id of [target.id, username]) {
            const response = await client.api.user[":id"].$get({
                param: { id },
            });
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                id: target.id,
                username,
            });
        }
    },
    500_000,
);
