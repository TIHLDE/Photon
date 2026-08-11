import { createTestingRole, getUserRoles } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * Self-registration on the website, and the approval that turns it into a
 * membership.
 *
 * Anyone may sign up with a private address now. What that buys them on its own
 * is an account and nothing else: no member role, no members-only pages, no
 * event registration. An admin approving them is what changes that, and these
 * tests are mostly about the "and nothing else" half holding.
 */
describe("self-registration and approval", () => {
    /** Sign up over plain HTTP, the way the website does. */
    async function signUp(
        ctx: IntegrationTestContext,
        body: {
            name: string;
            email: string;
            password: string;
            username?: string;
        },
    ) {
        return await ctx.app.request("/api/auth/sign-up/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    }

    async function userByEmail(ctx: IntegrationTestContext, email: string) {
        const [row] = await ctx.db
            .select()
            .from(schema.user)
            .where(eq(schema.user.email, email));
        return row;
    }

    integrationTest(
        "a private address is accepted, and the account waits for approval",
        async ({ ctx }) => {
            const res = await signUp(ctx, {
                name: "Kari Nordmann",
                email: "kari.nordmann@gmail.com",
                password: "hemmeligpassord",
            });

            expect(res.status).toBe(200);

            const row = await userByEmail(ctx, "kari.nordmann@gmail.com");
            // The username is the local part, dot and all — narrowing it to
            // "karinordmann" would produce exactly the shape NTNU hands out.
            expect(row?.username).toBe("kari.nordmann");
            expect(row?.approvalStatus).toBe("pending");
        },
    );

    integrationTest(
        "a taken username is rejected, and naming one gets past it",
        async ({ ctx }) => {
            await signUp(ctx, {
                name: "Kari Nordmann",
                email: "kari.nordmann@gmail.com",
                password: "hemmeligpassord",
            });

            const collision = await signUp(ctx, {
                name: "Kari Andersen",
                email: "kari.nordmann@outlook.com",
                password: "hemmeligpassord",
            });
            expect(collision.status).toBe(409);
            expect(await collision.text()).toContain("opptatt");

            const named = await signUp(ctx, {
                name: "Kari Andersen",
                email: "kari.nordmann@outlook.com",
                password: "hemmeligpassord",
                username: "kari.andersen",
            });
            expect(named.status).toBe(200);

            const row = await userByEmail(ctx, "kari.nordmann@outlook.com");
            expect(row?.username).toBe("kari.andersen");
        },
    );

    integrationTest(
        "a stud address keeps its NTNU username, whatever the body asks for",
        async ({ ctx }) => {
            const res = await signUp(ctx, {
                name: "Ola Nordmann",
                email: "olanor@stud.ntnu.no",
                password: "hemmeligpassord",
                // A student must not be able to claim someone else's NTNU
                // username by typing it here.
                username: "someoneelse",
            });

            expect(res.status).toBe(200);
            const row = await userByEmail(ctx, "olanor@stud.ntnu.no");
            expect(row?.username).toBe("olanor");
        },
    );

    integrationTest(
        "a pending account is turned away from routes that require a member",
        async ({ ctx }) => {
            const pending = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ approvalStatus: "pending" })
                .where(eq(schema.user.id, pending.id));

            const client = await ctx.utils.clientForUser(pending);

            // Their own settings stay reachable — they have to be able to
            // finish setting the account up while they wait. (404 here means
            // "no settings row yet", which is a different question; what
            // matters is that the approval guard did not turn them away.)
            const res = await client.api.user.me.settings.$get();
            expect(res.status).not.toBe(403);

            // Their own profile too: det er den eneste siden i Kvark der man
            // finner «Logg ut», så en 403 der låser dem inne i kontoen.
            const own = await client.api.user[":id"].$get({
                param: { id: pending.id },
            });
            expect(own.status).toBe(200);

            const other = await ctx.utils.createTestUser();
            const denied = await client.api.user[":id"].$get({
                param: { id: other.id },
            });
            expect(denied.status).toBe(403);
        },
    );

    integrationTest(
        "members-only events stay hidden until the account is approved",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            await ctx.utils.createTestEvent({
                title: "Internt medlemsmøte",
                visibility: "members",
            });

            const pending = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ approvalStatus: "pending" })
                .where(eq(schema.user.id, pending.id));
            const client = await ctx.utils.clientForUser(pending);

            const res = await client.api.event.$get({ query: {} });
            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                items: { title: string }[];
            };
            expect(
                body.items.some((e) => e.title === "Internt medlemsmøte"),
            ).toBe(false);
        },
    );

    integrationTest(
        "approving grants the member role and closes the queue entry",
        async ({ ctx }) => {
            // The role approval hands out. Seeded for real in `seedRbac`, but
            // an integration database starts empty.
            await createTestingRole(ctx, {
                name: "member",
                permissions: ["events:registrations:create"],
                description: "Baseline member role",
                position: 2,
            });

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const pending = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ approvalStatus: "pending" })
                .where(eq(schema.user.id, pending.id));

            const res = await client.api.user[":id"].approve.$post({
                param: { id: pending.id },
            });
            expect(res.status).toBe(200);

            const [row] = await ctx.db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, pending.id));
            expect(row?.approvalStatus).toBe("approved");
            expect(row?.approvedAt).not.toBeNull();
            expect(row?.approvedBy).toBe(admin.id);
            expect(await getUserRoles(ctx, pending.id)).toContain("member");

            // Approving twice is a mistake worth naming, not a silent no-op.
            const again = await client.api.user[":id"].approve.$post({
                param: { id: pending.id },
            });
            expect(again.status).toBe(400);
        },
    );

    integrationTest("approving requires users:manage", async ({ ctx }) => {
        const caller = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(caller, ["users:view"]);
        const client = await ctx.utils.clientForUser(caller);

        const pending = await ctx.utils.createTestUser();
        await ctx.db
            .update(schema.user)
            .set({ approvalStatus: "pending" })
            .where(eq(schema.user.id, pending.id));

        const res = await client.api.user[":id"].approve.$post({
            param: { id: pending.id },
        });
        expect(res.status).toBe(403);
    });
});
