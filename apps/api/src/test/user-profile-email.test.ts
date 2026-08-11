import { expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * E-posten på en profil er ikke medlemsinnhold: den vises for deg selv, og for
 * en admin med `users:view` — de samme som ser den i brukerlista. Et vanlig
 * medlem som ser på en annens profil skal ikke få den.
 */
integrationTest(
    "shows a profile e-mail to the user themselves and to users:view, not to other members",
    async ({ ctx }) => {
        const target = await ctx.utils.createTestUser();

        const own = await ctx.utils.clientForUser(target);
        const ownResponse = await own.api.user[":id"].$get({
            param: { id: target.id },
        });
        expect(ownResponse.status).toBe(200);
        expect((await ownResponse.json()).email).toBe(target.email);

        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:view"]);
        const adminClient = await ctx.utils.clientForUser(admin);
        const adminResponse = await adminClient.api.user[":id"].$get({
            param: { id: target.id },
        });
        expect(adminResponse.status).toBe(200);
        expect((await adminResponse.json()).email).toBe(target.email);

        const member = await ctx.utils.createTestUser();
        const memberClient = await ctx.utils.clientForUser(member);
        const memberResponse = await memberClient.api.user[":id"].$get({
            param: { id: target.id },
        });
        expect(memberResponse.status).toBe(200);
        expect((await memberResponse.json()).email).toBeNull();
    },
    500_000,
);
