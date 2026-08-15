import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * Å gi fra seg en bekreftet plass frigjør den, og da skal den øverste på
 * ventelista rykke opp. Før gjorde ingenting det: resolveren ser bare på
 * `pending`-rader, og en ventelistet er `waitlisted` — så plassen ble stående
 * tom til noen nye meldte seg på.
 */
async function statusFor(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
) {
    const row = await ctx.db.query.eventRegistration.findFirst({
        where: (reg, { and, eq }) =>
            and(eq(reg.eventId, eventId), eq(reg.userId, userId)),
    });
    return { status: row?.status, position: row?.waitlistPosition };
}

describe("waitlist promotion when a spot is freed", () => {
    integrationTest(
        "unregistering hands the spot to the first person on the waitlist",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `opprykk-${Date.now()}`,
                capacity: 1,
            });

            const holder = await ctx.utils.createTestUser();
            const waiting = await ctx.utils.createTestUser();

            for (const user of [holder, waiting]) {
                await ctx.utils.giveUserPermissions(user, [
                    "events:registrations:create",
                ]);
                await ctx.utils.acceptEventRules(user.id);
            }

            // Holder tar den ene plassen, waiting havner på venteliste.
            await ctx.utils.createPendingRegistration(event.id, holder.id);
            await resolveRegistrationsForEvent(event.id, ctx);
            await new Promise((r) => setTimeout(r, 10));
            await ctx.utils.createPendingRegistration(event.id, waiting.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            expect((await statusFor(ctx, event.id, holder.id)).status).toBe(
                "registered",
            );
            expect((await statusFor(ctx, event.id, waiting.id)).status).toBe(
                "waitlisted",
            );

            const client = await ctx.utils.clientForUser(holder);
            const response = await client.api.event[
                ":eventId"
            ].registration.$delete({
                param: { eventId: event.id },
            });

            expect(response.status).toBe(200);

            const promoted = await statusFor(ctx, event.id, waiting.id);
            expect(promoted.status).toBe("registered");
            expect(promoted.position).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "leaving the waitlist promotes nobody — no spot was freed",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `ingen-opprykk-${Date.now()}`,
                capacity: 1,
            });

            const holder = await ctx.utils.createTestUser();
            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();

            for (const user of [holder, first, second]) {
                await ctx.utils.giveUserPermissions(user, [
                    "events:registrations:create",
                ]);
                await ctx.utils.acceptEventRules(user.id);
            }

            for (const user of [holder, first, second]) {
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);
                await new Promise((r) => setTimeout(r, 10));
            }

            expect((await statusFor(ctx, event.id, first.id)).status).toBe(
                "waitlisted",
            );

            // `first` forlater ventelista. Plassen til `holder` er urørt, så
            // `second` skal fortsatt stå på venteliste.
            const client = await ctx.utils.clientForUser(first);
            await client.api.event[":eventId"].registration.$delete({
                param: { eventId: event.id },
            });

            expect((await statusFor(ctx, event.id, holder.id)).status).toBe(
                "registered",
            );
            expect((await statusFor(ctx, event.id, second.id)).status).toBe(
                "waitlisted",
            );
        },
        500_000,
    );

    integrationTest(
        "an event with room to spare promotes nobody it should not",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `ledig-${Date.now()}`,
                capacity: 5,
            });

            const leaving = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(leaving, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(leaving.id);

            await ctx.utils.createPendingRegistration(event.id, leaving.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const client = await ctx.utils.clientForUser(leaving);
            await client.api.event[":eventId"].registration.$delete({
                param: { eventId: event.id },
            });

            const rows = await ctx.db
                .select()
                .from(schema.eventRegistration)
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, event.id),
                        eq(schema.eventRegistration.status, "registered"),
                    ),
                );

            expect(rows).toHaveLength(0);
        },
        500_000,
    );
});
