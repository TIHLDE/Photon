import { describe, expect, vi } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";

vi.mock("~/lib/vipps", () => ({
    refundPayment: vi.fn(),
    capturePayment: vi.fn(),
    cancelPayment: vi.fn(),
    createPayment: vi.fn(),
    getPaymentDetails: vi.fn(),
    setupWebhooks: vi.fn(),
    verifyVippsWebhookRequest: vi.fn(),
}));

/**
 * What one resolver pass costs in database round trips.
 *
 * The number is the point, not the wall clock: locally every query answers in
 * microseconds, while in production each one is a round trip from a loaded API
 * container. The batch that opened the immatrikuleringsball — 121 sign-ups in
 * three seconds — took 5,5 seconds to resolve, ~70 ms per member, because the
 * pass asked seven questions per member one after the other while holding its
 * `FOR UPDATE` locks.
 *
 * Only what happens before the commit is what a member waits for: that is when
 * their spot becomes visible. The notifications after it are counted separately
 * so a regression in one is not hidden by the other.
 */

const MEMBERS = 120;

type CountingPglite = {
    query: (...args: unknown[]) => unknown;
    exec: (...args: unknown[]) => unknown;
    transaction: (
        fn: (tx: { query: (...args: unknown[]) => unknown }) => unknown,
    ) => unknown;
};

describe("Resolver cost", () => {
    integrationTest(
        "resolves a full sign-up batch without a round trip per member",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({
                capacity: 164,
                isPaidEvent: true,
                priceMinor: 51000,
            });
            for (let i = 0; i < MEMBERS; i++) {
                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
            }

            const pglite = (ctx as unknown as { _pglite: CountingPglite })
                ._pglite;
            const originalQuery = pglite.query.bind(pglite);
            const originalExec = pglite.exec.bind(pglite);
            const originalTx = pglite.transaction.bind(pglite);

            let queries = 0;
            let queriesAtCommit = 0;
            let msAtCommit = 0;

            pglite.query = (...args: unknown[]) => {
                queries++;
                return originalQuery(...args);
            };
            pglite.exec = (...args: unknown[]) => {
                queries++;
                return originalExec(...args);
            };
            pglite.transaction = (fn) =>
                originalTx(async (tx) => {
                    const txQuery = tx.query.bind(tx);
                    tx.query = (...args: unknown[]) => {
                        queries++;
                        return txQuery(...args);
                    };
                    const result = await fn(tx);
                    queriesAtCommit = queries;
                    msAtCommit = performance.now() - started;
                    return result;
                });

            const started = performance.now();
            await resolveRegistrationsForEvent(event.id, ctx);
            const ms = performance.now() - started;

            pglite.query = originalQuery;
            pglite.exec = originalExec;
            pglite.transaction = originalTx;

            console.log(
                `Fram til commit (det medlemmet venter på): ${queriesAtCommit} spørringer, ${msAtCommit.toFixed(0)} ms, ${(queriesAtCommit / MEMBERS).toFixed(2)} per medlem\n` +
                    `Totalt, varsler etter commit inkludert: ${queries} spørringer, ${ms.toFixed(0)} ms`,
            );

            const registered = await ctx.db.query.eventRegistration.findMany({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.status, "registered")),
            });
            expect(registered).toHaveLength(MEMBERS);

            const payments = await ctx.db.query.eventPayment.findMany({
                where: (p, { eq }) => eq(p.eventId, event.id),
            });
            expect(payments).toHaveLength(MEMBERS);

            /**
             * The bound that keeps the win: a pass costs a handful of
             * statements plus what the waitlist needs, never one per member.
             * It was 840 before the batching, seven per member.
             */
            expect(queriesAtCommit).toBeLessThan(MEMBERS / 2);
        },
        500_000,
    );
});
