import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { enforceExpiredPaymentDeadlines } from "~/lib/event/payment-sweep";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";

/**
 * Betalingsfristen håndheves normalt av en forsinket jobb i køen. Køen ligger
 * i Redis, og prod-Redis har ingen varig lagring — en omstart tar med seg alle
 * forsinkede jobber. Fram til nå fantes det ingen vei tilbake: ingenting leste
 * `expires_at` fra basen, så en ubetalt plass ble aldri inndratt og ventelista
 * rykket aldri.
 *
 * Testene under fyrer aldri av timeren. De etterligner et køtap ved å la
 * fristen løpe ut i basen alene, og krever at sweepen tar den.
 */
describe("betalingsfrist-sweep når køen har mistet jobben", () => {
    integrationTest(
        "inndrar den ubetalte plassen og rykker ventelista, uten at timeren fyrte",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                capacity: 1,
                isPaidEvent: true,
                priceMinor: 5000,
            });

            const unpaid = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, unpaid.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            await new Promise((resolve) => setTimeout(resolve, 10));

            const waiting = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, waiting.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const obligation = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, unpaid.id)),
            });
            expect(obligation?.status).toBe("pending");

            // Køtapet: jobben finnes ikke lenger, og fristen går ut i basen
            // alene. Ingen timer fyres i denne testen.
            await ctx.db
                .update(schema.eventPayment)
                .set({ expiresAt: new Date(Date.now() - 60_000) })
                .where(eq(schema.eventPayment.id, obligation?.id ?? ""));

            const handled = await enforceExpiredPaymentDeadlines(ctx);
            expect(handled).toBe(1);

            const reclaimed = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, unpaid.id)),
            });
            expect(reclaimed?.status).toBe("cancelled");

            const closed = await ctx.db.query.eventPayment.findFirst({
                where: (p, { eq }) => eq(p.id, obligation?.id ?? ""),
            });
            expect(closed?.status).toBe("failed");

            // Poenget med å inndra plassen: den neste skal få den.
            const promoted = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, waiting.id)),
            });
            expect(promoted?.status).toBe("registered");
            expect(promoted?.waitlistPosition).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "rører ikke en frist som fortsatt løper",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                capacity: 5,
                isPaidEvent: true,
                priceMinor: 5000,
            });

            const member = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, member.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const obligation = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, member.id)),
            });
            expect(obligation?.status).toBe("pending");

            const handled = await enforceExpiredPaymentDeadlines(ctx);
            expect(handled).toBe(0);

            const untouched = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, member.id)),
            });
            expect(untouched?.status).toBe("registered");
        },
        500_000,
    );

    integrationTest(
        "lar en betalt plass stå, selv om fristen er passert",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                capacity: 5,
                isPaidEvent: true,
                priceMinor: 5000,
            });

            const member = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, member.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const obligation = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, member.id)),
            });

            // Betalt, men fristen står igjen i fortida — nøyaktig raden en
            // sweep uten vett ville tatt.
            await ctx.db
                .update(schema.eventPayment)
                .set({
                    status: "paid",
                    expiresAt: new Date(Date.now() - 60_000),
                })
                .where(eq(schema.eventPayment.id, obligation?.id ?? ""));

            const handled = await enforceExpiredPaymentDeadlines(ctx);
            expect(handled).toBe(0);

            const kept = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, member.id)),
            });
            expect(kept?.status).toBe("registered");
        },
        500_000,
    );
});
