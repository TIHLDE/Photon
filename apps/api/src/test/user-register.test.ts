import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * POST /api/user/register — account creation on behalf of another TIHLDE
 * service.
 *
 * Exists for Fadderuka, which runs its own sign-up form. The rules are
 * deliberately the website's own: @stud.ntnu.no only, username derived from the
 * address rather than chosen by the caller. What is tested here is mostly that
 * those rules cannot be sidestepped by going through this route instead.
 */
describe("POST /api/user/register", () => {
    /** An API key holding `permissions`, and the key string to send. */
    async function apiKeyWith(
        ctx: IntegrationTestContext,
        permissions: string[],
    ): Promise<string> {
        const owner = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(owner, ["api-keys:create"]);
        const client = await ctx.utils.clientForUser(owner);

        const res = await client.api["api-keys"].$post({
            json: {
                name: `test-${permissions.join("-")}`,
                description: "user-register test key",
                permissions,
            },
        });
        expect(res.status).toBe(201);
        return ((await res.json()) as { key: string }).key;
    }

    const body = {
        name: "Ola Nordmann",
        email: "olanor@stud.ntnu.no",
        password: "hemmeligpassord",
        studyProgramSlug: "dataingenir",
    };

    integrationTest(
        "creates the member, derives the username and enrols them",
        async ({ ctx }) => {
            await ctx.utils.createTestGroup({
                slug: "dataingenir",
                name: "Dataingeniør",
                type: "STUDY",
            });
            const key = await apiKeyWith(ctx, ["users:create"]);

            const res = await ctx.app.request("/api/user/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify(body),
            });

            expect(res.status).toBe(201);
            const created = (await res.json()) as {
                id: string;
                username: string;
                emailVerificationRequired: boolean;
            };
            // The caller never picks the username: it is the address's local
            // part, which is the student's NTNU username.
            expect(created.username).toBe("olanor");
            expect(created.emailVerificationRequired).toBe(true);

            const [row] = await ctx.db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, created.id));
            expect(row?.email).toBe("olanor@stud.ntnu.no");

            // Enrolled in the programme, so the profile shows a study and the
            // cohort-based rules downstream have something to read.
            const memberships = await ctx.db
                .select()
                .from(schema.groupMembership)
                .where(eq(schema.groupMembership.userId, created.id));
            expect(memberships.map((m) => m.groupSlug)).toContain(
                "dataingenir",
            );
        },
    );

    /**
     * A Feide-made account: `username` is the NTNU username, `email` is
     * whatever address Feide handed out — usually NOT
     * `<username>@stud.ntnu.no`. This is the shape that used to crash the
     * route, since nothing looked at the username and the address looked new.
     */
    async function existingFeideAccount(
        ctx: IntegrationTestContext,
        username: string,
    ): Promise<void> {
        const user = await ctx.utils.createTestUser(
            `${username}@privat.example.com`,
        );
        await ctx.db
            .update(schema.user)
            .set({ username })
            .where(eq(schema.user.id, user.id));
    }

    integrationTest(
        "answers 409 when the NTNU username is taken by another address",
        async ({ ctx }) => {
            await ctx.utils.createTestGroup({
                slug: "dataingenir",
                name: "Dataingeniør",
                type: "STUDY",
            });
            await existingFeideAccount(ctx, "olanor");
            const key = await apiKeyWith(ctx, ["users:create"]);

            const res = await ctx.app.request("/api/user/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify(body),
            });

            // Not a 500: the caller has to be able to tell the student that
            // what they want is to log in, not to register.
            expect(res.status).toBe(409);
            const { message } = (await res.json()) as { message: string };
            expect(message).toContain("olanor");

            // And nothing was created for the address that was still free.
            const rows = await ctx.db
                .select()
                .from(schema.user)
                .where(eq(schema.user.email, "olanor@stud.ntnu.no"));
            expect(rows).toHaveLength(0);
        },
    );

    integrationTest(
        "the sign-up hook itself rejects a taken username",
        async ({ ctx }) => {
            // The website's own sign-up never touches the route above, so the
            // check has to hold in the hook too — the username plugin's own
            // uniqueness check does not run for /sign-up/email.
            await existingFeideAccount(ctx, "olanor");

            const res = await ctx.app.request("/api/auth/sign-up/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: body.name,
                    email: body.email,
                    password: body.password,
                }),
            });

            expect(res.status).toBe(409);
        },
    );

    integrationTest("refuses a non-NTNU address", async ({ ctx }) => {
        const key = await apiKeyWith(ctx, ["users:create"]);

        const res = await ctx.app.request("/api/user/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({ ...body, email: "ola@gmail.com" }),
        });

        expect(res.status).toBe(400);
    });

    integrationTest(
        "refuses an API key without users:create",
        async ({ ctx }) => {
            const key = await apiKeyWith(ctx, ["users:view"]);

            const res = await ctx.app.request("/api/user/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify(body),
            });

            expect(res.status).toBe(403);
        },
    );

    integrationTest(
        "refuses a signed-in member without an API key",
        async ({ ctx }) => {
            // A cookie must not be able to mint accounts: this route skips the
            // proof of address ownership that the website's own sign-up makes,
            // and that shortcut belongs to a trusted service, not to a member.
            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const res = await client.api.user.register.$post({
                json: body,
            });

            expect(res.status).toBe(403);
        },
    );
});
