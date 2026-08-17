import { REGISTRATION_QUEUE_NAME } from "@photon/core/services/queue";
import { describe, expect } from "vitest";
import type { RegistrationResolveJobData } from "~/lib/event/resolve-queue";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * Påmeldingen legges inn som «pending» og avgjøres av resolveren. Før ventet
 * den på at cron-en skulle plukke den opp, i opptil fem sekunder; nå ber ruten
 * om en resolver-runde selv. Jobbene kjøres ikke av seg selv i testene — det
 * er `startBackgroundJobs` som starter workeren — så testene her sjekker at
 * ruten legger inn jobben, og kjører resolveren selv der utfallet er poenget.
 */
async function queuedResolveJobs(ctx: IntegrationTestContext) {
    const jobs = await ctx.queue
        .getQueue<RegistrationResolveJobData>(REGISTRATION_QUEUE_NAME)
        .getJobs();
    return jobs.map((job) => job.data.eventId);
}

describe("registration is queued for resolution without waiting for the cron", () => {
    integrationTest(
        "registering asks for the event to be resolved right away",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `straks-${Date.now()}`,
                capacity: 10,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(200);
            expect(await queuedResolveJobs(ctx)).toEqual([event.id]);

            // Ruten svarer før plassen er avgjort, så raden er «pending» til
            // workeren har kjørt.
            const queued = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, event.id), eq(reg.userId, user.id)),
            });
            expect(queued?.status).toBe("pending");

            await resolveRegistrationsForEvent(event.id, ctx);

            const resolved = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, event.id), eq(reg.userId, user.id)),
            });
            expect(resolved?.status).toBe("registered");
        },
        500_000,
    );

    integrationTest(
        "back-to-back registrations for the last spot keep FIFO order",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `siste-plass-${Date.now()}`,
                capacity: 1,
            });

            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();

            for (const user of [first, second]) {
                await ctx.utils.giveUserPermissions(user, [
                    "events:registrations:create",
                ]);
                await ctx.utils.acceptEventRules(user.id);
            }

            for (const user of [first, second]) {
                const client = await ctx.utils.clientForUser(user);
                const response = await client.api.event[
                    ":eventId"
                ].registration.$post({
                    param: { eventId: event.id },
                    json: {},
                });
                expect(response.status).toBe(200);
            }

            // Én jobb per påmelding. En runde uten noe å gjøre koster ett
            // indeksert oppslag, så duplikatene er billige og trenger ingen
            // deduplisering.
            expect(await queuedResolveJobs(ctx)).toEqual([event.id, event.id]);

            await resolveRegistrationsForEvent(event.id, ctx);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            const status = (userId: string) =>
                rows.find((row) => row.userId === userId)?.status;

            expect(status(first.id)).toBe("registered");
            expect(status(second.id)).toBe("waitlisted");
        },
        500_000,
    );
});
