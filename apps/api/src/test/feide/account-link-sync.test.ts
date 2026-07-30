import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * The endpoint that finishes an account link.
 *
 * Better Auth's `/oauth2/callback` has two branches. Signing in mints a
 * session; linking writes the account row and redirects without one, because
 * the member was already signed in. `syncFeideHook` keys on that new session to
 * learn who to sync, so a link syncs nobody — and the member ends up with a
 * working Feide login and no study programme, campus or cohort.
 *
 * Five members reached exactly that state in production on 2026-07-30. This
 * endpoint is what the post-link page calls to close the gap, using the session
 * the callback never had.
 */

const dataportenGroups = [
    {
        id: "fc:fs:fs:kull:ntnu.no:BIDATA:2026H",
        type: "fc:fs:kull",
        displayName: "Kull for Høst 2026 BIDATA",
        membership: { active: true },
    },
    {
        id: "fc:fs:fs:emne:ntnu.no:IDATT1003:1",
        type: "fc:fs:emne",
        displayName: "IDATT1003",
        membership: { active: true },
    },
];

/**
 * Stand in for Dataporten. The sync reaches the network through a bare
 * `fetch`, so this is the seam — and stubbing it also keeps the suite from
 * depending on Feide being up.
 */
const stubDataporten = (groups: unknown = dataportenGroups) => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.includes("groups-api.dataporten.no")) {
            return new Response(JSON.stringify(groups), { status: 200 });
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("POST /api/account-link/sync", () => {
    integrationTest("rejects a caller without a session", async ({ ctx }) => {
        const client = ctx.utils.client();
        const res = await client.api["account-link"].sync.$post();

        expect(res.status).toBe(401);
    });

    integrationTest(
        "answers 409 when the user has never linked Feide",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const res = await client.api["account-link"].sync.$post();

            // Distinct from a Feide outage on purpose: nothing is wrong, they
            // simply have no Feide account for us to read.
            expect(res.status).toBe(409);
        },
    );

    integrationTest(
        "writes the study programme a link never got around to",
        async ({ ctx }) => {
            stubDataporten();

            const user = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.group).values({
                slug: "dataingenior",
                name: "Dataingeniør",
                type: "STUDY",
                finesInfo: "",
                finesActivated: false,
            });
            await ctx.db.insert(schema.studyProgram).values({
                slug: "dataingenior",
                feideCode: "BIDATA",
                displayName: "Dataingeniør",
                type: "bachelor",
            });
            await ctx.db
                .insert(schema.role)
                .values([{ name: "member" }, { name: "alumni" }])
                .onConflictDoNothing();

            // What linking leaves behind: an account row with a token, and
            // nothing else.
            await ctx.db.insert(schema.account).values({
                id: "acc-feide-test",
                userId: user.id,
                providerId: "feide",
                accountId: "feide-user-1",
                accessToken: "token-from-the-link",
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api["account-link"].sync.$post();

            expect(res.status).toBe(200);

            const [membership] = await ctx.db
                .select({
                    startYear: schema.studyProgramMembership.startYear,
                    campus: schema.studyProgramMembership.confirmedCampus,
                })
                .from(schema.studyProgramMembership)
                .where(eq(schema.studyProgramMembership.userId, user.id));

            expect(membership?.startYear).toBe(2026);
            expect(membership?.campus).toBe("trondheim");

            const groups = await ctx.db
                .select({ slug: schema.groupMembership.groupSlug })
                .from(schema.groupMembership)
                .where(eq(schema.groupMembership.userId, user.id));

            // Both groups event priority selects on.
            expect(groups.map((g) => g.slug).sort()).toEqual([
                "2026",
                "dataingenior",
            ]);
        },
    );

    integrationTest(
        "can be run twice without duplicating anything",
        async ({ ctx }) => {
            stubDataporten();

            const user = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.group).values({
                slug: "dataingenior",
                name: "Dataingeniør",
                type: "STUDY",
                finesInfo: "",
                finesActivated: false,
            });
            await ctx.db.insert(schema.studyProgram).values({
                slug: "dataingenior",
                feideCode: "BIDATA",
                displayName: "Dataingeniør",
                type: "bachelor",
            });
            await ctx.db
                .insert(schema.role)
                .values([{ name: "member" }, { name: "alumni" }])
                .onConflictDoNothing();

            await ctx.db.insert(schema.account).values({
                id: "acc-feide-test-2",
                userId: user.id,
                providerId: "feide",
                accountId: "feide-user-2",
                accessToken: "token-from-the-link",
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const client = await ctx.utils.clientForUser(user);

            // A reload of the post-link page, or a member pressing back, must
            // cost nothing — this is the repair tool for the five already in
            // the broken state, so it will be run more than once on purpose.
            expect((await client.api["account-link"].sync.$post()).status).toBe(
                200,
            );
            expect((await client.api["account-link"].sync.$post()).status).toBe(
                200,
            );

            const memberships = await ctx.db
                .select({ userId: schema.studyProgramMembership.userId })
                .from(schema.studyProgramMembership)
                .where(eq(schema.studyProgramMembership.userId, user.id));

            expect(memberships).toHaveLength(1);
        },
    );

    integrationTest(
        "answers 502 when Dataporten cannot be reached",
        async ({ ctx }) => {
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => new Response("nope", { status: 503 })),
            );

            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.account).values({
                id: "acc-feide-test-3",
                userId: user.id,
                providerId: "feide",
                accountId: "feide-user-3",
                accessToken: "token-from-the-link",
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api["account-link"].sync.$post();

            // Separated from the 409 so the page can say "we'll get it next
            // login" rather than "you have not linked Feide".
            expect(res.status).toBe(502);
        },
    );
});
