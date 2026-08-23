import {
    assignUserRole,
    createTestingRole,
    getUserRoles,
} from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * Moving a member between the two baseline roles by hand.
 *
 * The rule the whole route exists to serve is that `member` and `alumni` are
 * the same switch seen from two sides: one may register for events, the other
 * may not, and nothing else about the account changes. So the tests check the
 * påmelding rather than only the role rows — the role name is the mechanism,
 * not the promise.
 */
describe("baseline role", () => {
    /** The two roles as production seeds them, since a test db starts empty. */
    async function seedBaselineRoles(ctx: IntegrationTestContext) {
        await createTestingRole(ctx, {
            name: "member",
            description: "Baseline member role",
            permissions: ["events:registrations:create"],
            position: 2,
        });
        await createTestingRole(ctx, {
            name: "alumni",
            description: "Baseline alumni role",
            permissions: [],
            position: 1,
        });
    }

    async function adminClient(ctx: IntegrationTestContext) {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        return await ctx.utils.clientForUser(admin);
    }

    integrationTest(
        "an alumnus loses the påmelding and keeps everything else",
        async ({ ctx }) => {
            await seedBaselineRoles(ctx);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent();

            const member = await ctx.utils.createTestUser();
            await assignUserRole(ctx, member.id, "member");
            await ctx.utils.acceptEventRules(member.id);
            const memberClient = await ctx.utils.clientForUser(member);

            const admin = await adminClient(ctx);
            const res = await admin.api.user[":id"]["baseline-role"].$patch({
                param: { id: member.id },
                json: { role: "alumni" },
            });
            expect(res.status).toBe(200);

            const roles = await getUserRoles(ctx, member.id);
            expect(roles).toContain("alumni");
            // Holding both would leave the checker granting what the admin just
            // took away.
            expect(roles).not.toContain("member");

            const registration = await memberClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(registration.status).toBe(403);

            // Reading the event is not what they lost.
            const view = await memberClient.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(view.status).toBe(200);
        },
    );

    integrationTest(
        "an alumnus can be made a member again",
        async ({ ctx }) => {
            await seedBaselineRoles(ctx);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent();

            const alumnus = await ctx.utils.createTestUser();
            await assignUserRole(ctx, alumnus.id, "alumni");
            await ctx.utils.acceptEventRules(alumnus.id);
            const alumnusClient = await ctx.utils.clientForUser(alumnus);

            const admin = await adminClient(ctx);
            const res = await admin.api.user[":id"]["baseline-role"].$patch({
                param: { id: alumnus.id },
                json: { role: "member" },
            });
            expect(res.status).toBe(200);

            const roles = await getUserRoles(ctx, alumnus.id);
            expect(roles).toContain("member");
            expect(roles).not.toContain("alumni");

            const registration = await alumnusClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(registration.status).toBe(200);
        },
    );

    integrationTest("the admin list says which role it is", async ({ ctx }) => {
        await seedBaselineRoles(ctx);

        const alumnus = await ctx.utils.createTestUser();
        await assignUserRole(ctx, alumnus.id, "alumni");

        const viewer = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(viewer, ["users:view"]);
        const client = await ctx.utils.clientForUser(viewer);

        const res = await client.api.user.$get({ query: {} });
        expect(res.status).toBe(200);
        const body = await res.json();
        const row = body.items.find((u) => u.id === alumnus.id);
        expect(row?.baselineRole).toBe("alumni");

        // Someone Feide has never placed holds neither role, and the list must
        // not invent one for them.
        const stranger = body.items.find((u) => u.id === viewer.id);
        expect(stranger?.baselineRole).toBeNull();
    });

    integrationTest(
        "an account can be approved straight into alumni",
        async ({ ctx }) => {
            await seedBaselineRoles(ctx);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent();

            const pending = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ approvalStatus: "pending" })
                .where(eq(schema.user.id, pending.id));
            await ctx.utils.acceptEventRules(pending.id);

            const admin = await adminClient(ctx);
            const res = await admin.api.user[":id"].approve.$post({
                param: { id: pending.id },
                json: { role: "alumni" },
            });
            expect(res.status).toBe(200);

            const [row] = await ctx.db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, pending.id));
            expect(row?.approvalStatus).toBe("approved");

            const roles = await getUserRoles(ctx, pending.id);
            expect(roles).toContain("alumni");
            // The whole point of choosing at approval time: `member` is never
            // handed out and taken back, so there is no window where they
            // could have registered for something.
            expect(roles).not.toContain("member");

            // Approved, so no longer turned away by the pending guard...
            const client = await ctx.utils.clientForUser(pending);
            const view = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(view.status).toBe(200);

            // ...but still not someone who may register.
            const registration = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(registration.status).toBe(403);
        },
    );

    integrationTest(
        "approving without a role still means member",
        async ({ ctx }) => {
            await seedBaselineRoles(ctx);

            const pending = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ approvalStatus: "pending" })
                .where(eq(schema.user.id, pending.id));

            const admin = await adminClient(ctx);
            const res = await admin.api.user[":id"].approve.$post({
                param: { id: pending.id },
                json: {},
            });
            expect(res.status).toBe(200);
            expect(await getUserRoles(ctx, pending.id)).toContain("member");
        },
    );

    integrationTest("changing it requires users:manage", async ({ ctx }) => {
        await seedBaselineRoles(ctx);

        const target = await ctx.utils.createTestUser();
        await assignUserRole(ctx, target.id, "member");

        const caller = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(caller, ["users:view"]);
        const client = await ctx.utils.clientForUser(caller);

        const res = await client.api.user[":id"]["baseline-role"].$patch({
            param: { id: target.id },
            json: { role: "alumni" },
        });
        expect(res.status).toBe(403);
        expect(await getUserRoles(ctx, target.id)).toContain("member");
    });

    integrationTest("an unknown user is a 404", async ({ ctx }) => {
        await seedBaselineRoles(ctx);
        const admin = await adminClient(ctx);

        const res = await admin.api.user[":id"]["baseline-role"].$patch({
            param: { id: "00000000-0000-0000-0000-000000000000" },
            json: { role: "alumni" },
        });
        expect(res.status).toBe(404);
    });
});
