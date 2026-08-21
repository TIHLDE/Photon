import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * En kansellert påmelding er sporet etter en som tok slutt — fristen gikk ut,
 * prikkene sperret, eller påmeldingen ble stengt. Varselet brukeren får sier
 * «Du kan melde deg på på nytt», men raden ble liggende og svarte 409 på
 * forsøket. Det låste ute alle som mistet plassen på Immatrikuleringsball 2026
 * uten å betale i tide.
 */
async function seedCancelledRegistration(ctx: IntegrationTestContext) {
    await ctx.utils.setupGroups();
    await ctx.utils.setupEventCategories();

    const event = await ctx.utils.createTestEvent({ capacity: 10 });
    const user = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(user, ["events:registrations:create"]);
    await ctx.utils.acceptEventRules(user.id);

    await ctx.db.insert(schema.eventRegistration).values({
        eventId: event.id,
        userId: user.id,
        status: "cancelled",
        waitlistPosition: 3,
    });

    return { event, user };
}

describe("melde seg på igjen etter en kansellert plass", () => {
    integrationTest(
        "en kansellert rad sperrer ikke for en ny påmelding",
        async ({ ctx }) => {
            const { event, user } = await seedCancelledRegistration(ctx);
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(200);

            await resolveRegistrationsForEvent(event.id, ctx);

            const reg = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, user.id)),
            });
            expect(reg?.status).toBe("registered");
            // Ventelisteplassen hørte til runden som tok slutt.
            expect(reg?.waitlistPosition).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "en plass som står blir fortsatt avvist",
        async ({ ctx }) => {
            const { event, user } = await seedCancelledRegistration(ctx);

            await ctx.db
                .update(schema.eventRegistration)
                .set({ status: "registered", waitlistPosition: null })
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, event.id),
                        eq(schema.eventRegistration.userId, user.id),
                    ),
                );

            const client = await ctx.utils.clientForUser(user);
            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "en ny påmelding stiller bakerst i køen, ikke der den gamle sto",
        async ({ ctx }) => {
            const { event, user } = await seedCancelledRegistration(ctx);

            // Den kansellerte raden er fra da påmeldingen åpnet.
            const gammel = new Date(Date.now() - 60 * 60 * 1000);
            await ctx.db
                .update(schema.eventRegistration)
                .set({ createdAt: gammel })
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, event.id),
                        eq(schema.eventRegistration.userId, user.id),
                    ),
                );

            const client = await ctx.utils.clientForUser(user);
            await client.api.event[":eventId"].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            const reg = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, user.id)),
            });
            expect(reg?.createdAt.getTime()).toBeGreaterThan(gammel.getTime());
        },
        500_000,
    );
});
