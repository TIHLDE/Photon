import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

const PRICE = 5000;

async function seedPaidEvent(ctx: IntegrationTestContext) {
    await ctx.utils.setupEventCategories();
    const creator = await ctx.utils.createTestUser();
    const payer = await ctx.utils.createTestUser();
    const event = await ctx.utils.createTestEvent({
        capacity: 10,
        isPaidEvent: true,
        priceMinor: PRICE,
        createdByUserId: creator.id,
    });
    return { creator, payer, event };
}

async function addPayment(
    ctx: IntegrationTestContext,
    values: {
        eventId: string;
        userId: string;
        status: "pending" | "paid" | "refunded";
        providerPaymentId?: string;
    },
) {
    const [row] = await ctx.db
        .insert(schema.eventPayment)
        .values({
            amountMinor: PRICE,
            currency: "NOK",
            provider: values.providerPaymentId ? "vipps" : null,
            ...values,
        })
        .returning();
    if (!row) throw new Error("Failed to seed payment");
    return row;
}

async function deleteAs(
    ctx: IntegrationTestContext,
    user: Awaited<
        ReturnType<IntegrationTestContext["utils"]["createTestUser"]>
    >,
    eventId: string,
) {
    const client = await ctx.utils.clientForUser(user);
    return client.api.event[":eventId"].$delete({ param: { eventId } });
}

/**
 * Payment rows cascade with the event, so deleting an event where money has
 * moved would erase the record of it.
 */
describe("Deleting an event with payments", () => {
    for (const status of ["paid", "refunded"] as const) {
        integrationTest(
            `refuses with a ${status} payment and keeps the row`,
            async ({ ctx }) => {
                const { creator, payer, event } = await seedPaidEvent(ctx);
                const row = await addPayment(ctx, {
                    eventId: event.id,
                    userId: payer.id,
                    status,
                    providerPaymentId: status,
                });

                const res = await deleteAs(ctx, creator, event.id);

                expect(res.status).toBe(409);
                expect(
                    await ctx.db.query.eventPayment.findFirst({
                        where: { id: row.id },
                    }),
                ).toBeDefined();
                expect(
                    await ctx.db.query.event.findFirst({
                        where: { id: event.id },
                    }),
                ).toBeDefined();
            },
            500_000,
        );
    }

    integrationTest(
        "still deletes an event where no money has moved",
        async ({ ctx }) => {
            const { creator, payer, event } = await seedPaidEvent(ctx);
            const other = await ctx.utils.createTestUser();
            await addPayment(ctx, {
                eventId: event.id,
                userId: payer.id,
                status: "pending",
            });
            await addPayment(ctx, {
                eventId: event.id,
                userId: other.id,
                status: "pending",
                providerPaymentId: "open-checkout",
            });

            const res = await deleteAs(ctx, creator, event.id);

            expect(res.status).toBe(200);
            expect(
                await ctx.db.query.event.findFirst({ where: { id: event.id } }),
            ).toBeUndefined();
        },
        500_000,
    );
});
