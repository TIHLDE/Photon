import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Å ha opprettet et arrangement er ikke en varig rettighet.
 *
 * `created_by_user_id` står for alltid, så den som satte opp arrangementet
 * kom inn på eierskap alene — også lenge etter at hen var ferdig i gruppen som
 * arrangerer det. Nå følger eierskapet medlemskapet: er du ute av
 * arrangørgruppen, må du ha tilgangen som alle andre.
 */

const eventBody = (organizerGroupSlug: string) => ({
    title: "Kurs",
    description: "Et arrangement gruppen eier",
    categorySlug: "bedpres",
    organizerGroupSlug,
    location: "Trondheim",
    imageUrl: null,
    start: "2025-12-01T18:00:00Z",
    end: "2025-12-01T20:00:00Z",
    registrationStart: null,
    registrationEnd: "2025-11-30T23:59:59Z",
    cancellationDeadline: null,
    capacity: 50,
    isRegistrationClosed: false,
    requiresSigningUp: true,
    allowWaitlist: true,
    priorityPools: null,
    onlyAllowPrioritized: false,
    canCauseStrikes: false,
    enforcesPreviousStrikes: false,
    isPaidEvent: false,
    price: null,
    contactPersonUserId: null,
    reactionsAllowed: true,
});

describe("The creator of a group's event", () => {
    integrationTest(
        "may still edit it while in the arranging group, but not after leaving",
        async ({ ctx }) => {
            const creator = await ctx.utils.createTestUser();

            // Bare «opprette», aldri «endre»: da er eierskapet det eneste som
            // kan slippe hen gjennom på PATCH, og testen måler nettopp det.
            await ctx.utils.giveUserPermissions(creator, ["events:create"]);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            await ctx.db.insert(schema.groupMembership).values({
                userId: creator.id,
                groupSlug: "index",
                role: "member",
            });

            const client = await ctx.utils.clientForUser(creator);

            const created = await client.api.event.$post({
                json: eventBody("index"),
            });
            expect(created.status).toBe(201);
            const { eventId } = await created.json();

            const whileMember = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { title: "Kurs, flyttet" },
            });
            expect(whileMember.status).toBe(200);

            await ctx.db
                .delete(schema.groupMembership)
                .where(
                    and(
                        eq(schema.groupMembership.userId, creator.id),
                        eq(schema.groupMembership.groupSlug, "index"),
                    ),
                );

            const afterLeaving = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { title: "Kurs, flyttet igjen" },
            });
            expect(afterLeaving.status).toBe(403);
        },
        500_000,
    );
});
