import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * The username a Feide-created account never gets.
 *
 * Better Auth builds a new OAuth user from name, email and image only, so a
 * member who signs up through Feide lands with `username` null. That is the
 * one field username sign-in matches on, and the login page's password form
 * asks for nothing else — so without this the member has no way to use a
 * password even after setting one.
 *
 * Filled in from the sync rather than at creation, which also repairs the
 * accounts already created without one.
 */

const USERID_SEC = "https://n.feide.no/claims/userid_sec";

const userinfoFor = (username: string) => ({
    sub: `feide-sub-${username}`,
    name: "Test Person",
    email: `${username}@ntnu.no`,
    [USERID_SEC]: [`feide:${username}@ntnu.no`],
});

/**
 * Stand in for Dataporten. The sync reaches the network through a bare
 * `fetch`, so this is the seam — and the userinfo endpoint is the one the
 * backfill reads, on top of the groups endpoint the study sync already used.
 */
const stubDataporten = (userinfo: unknown) => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.includes("groups-api.dataporten.no")) {
            return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes("auth.dataporten.no/openid/userinfo")) {
            return new Response(JSON.stringify(userinfo), { status: 200 });
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Feide username backfill", () => {
    integrationTest(
        "fills in the NTNU username on an account created through Feide",
        async ({ ctx }) => {
            stubDataporten(userinfoFor("mathstr"));

            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.account).values({
                id: "acc-backfill-1",
                userId: user.id,
                providerId: "feide",
                accountId: "feide-sub-mathstr",
                accessToken: "token",
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api["account-link"].sync.$post();
            expect(res.status).toBe(200);

            const [row] = await ctx.db
                .select({
                    username: schema.user.username,
                    displayUsername: schema.user.displayUsername,
                })
                .from(schema.user)
                .where(eq(schema.user.id, user.id));

            expect(row?.username).toBe("mathstr");
            expect(row?.displayUsername).toBe("mathstr");
        },
    );

    integrationTest(
        "leaves a username alone when it already belongs to someone else",
        async ({ ctx }) => {
            stubDataporten(userinfoFor("taken"));

            // A migrated member already holding that name — the collision
            // `resolveMigratedEmail` guards. Two different people, one name.
            const other = await ctx.utils.createTestUser("other@gmail.com");
            await ctx.db
                .update(schema.user)
                .set({ username: "taken", displayUsername: "taken" })
                .where(eq(schema.user.id, other.id));

            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.account).values({
                id: "acc-backfill-2",
                userId: user.id,
                providerId: "feide",
                accountId: "feide-sub-taken",
                accessToken: "token",
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api["account-link"].sync.$post();

            // Never at the cost of the login: the sync still succeeds, the
            // member simply keeps an empty username.
            expect(res.status).toBe(200);

            const [row] = await ctx.db
                .select({ username: schema.user.username })
                .from(schema.user)
                .where(eq(schema.user.id, user.id));

            expect(row?.username).toBeNull();
        },
    );

    integrationTest(
        "does not overwrite a username the account already has",
        async ({ ctx }) => {
            stubDataporten(userinfoFor("newname"));

            const user = await ctx.utils.createTestUser("migrated@gmail.com");
            await ctx.db
                .update(schema.user)
                .set({ username: "oldname", displayUsername: "oldname" })
                .where(eq(schema.user.id, user.id));

            await ctx.db.insert(schema.account).values({
                id: "acc-backfill-3",
                userId: user.id,
                providerId: "feide",
                accountId: "feide-sub-newname",
                accessToken: "token",
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const client = await ctx.utils.clientForUser(user);
            await client.api["account-link"].sync.$post();

            const [row] = await ctx.db
                .select({ username: schema.user.username })
                .from(schema.user)
                .where(eq(schema.user.id, user.id));

            // The stored name is what their history hangs off; Feide's is not
            // more correct just because it is newer.
            expect(row?.username).toBe("oldname");
        },
    );
});
