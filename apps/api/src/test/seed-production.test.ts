import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, vi } from "vitest";
import seed from "~/db/seed";
import { integrationTest } from "~/test/config/integration";

const overrides = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock("@photon/core/env", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@photon/core/env")>();
    return {
        ...actual,
        env: new Proxy({} as Record<string, unknown>, {
            get: (_, prop: string) =>
                prop in overrides
                    ? overrides[prop]
                    : (actual.env as unknown as Record<string, unknown>)[prop],
        }),
    };
});

afterEach(() => {
    delete overrides.NODE_ENV;
});

describe("seed", () => {
    integrationTest(
        "creates no default accounts in production",
        async ({ ctx }) => {
            overrides.NODE_ENV = "production";

            await seed(ctx);

            expect(await ctx.db.select().from(schema.user)).toEqual([]);
            expect(await ctx.db.select().from(schema.studyProgram)).not.toEqual(
                [],
            );
        },
    );

    integrationTest(
        "keeps running the backfills on every boot in production",
        async ({ ctx }) => {
            overrides.NODE_ENV = "production";
            await seed(ctx);
            await ctx.db
                .delete(schema.groupPosition)
                .where(eq(schema.groupPosition.name, "President"));

            await seed(ctx);

            const positions = await ctx.db
                .select()
                .from(schema.groupPosition)
                .where(eq(schema.groupPosition.name, "President"));
            expect(positions).toHaveLength(1);
        },
    );

    integrationTest("creates them outside production", async ({ ctx }) => {
        await seed(ctx);

        const emails = (await ctx.db.select().from(schema.user)).map(
            (user) => user.email,
        );
        expect(emails).toContain("test@test.com");
    });
});
