import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * DigSec runs under IIK while the other programmes run under IDI. An event
 * tied to one institute must only admit that institute's students — this is
 * the split issue #65 asks for.
 */
async function setupInstitutes(ctx: IntegrationTestContext) {
    const [idi, iik] = await ctx.db
        .insert(schema.institute)
        .values([
            {
                slug: `idi-${crypto.randomUUID()}`,
                shortName: "IDI",
                name: "Institutt for datateknologi og informatikk",
            },
            {
                slug: `iik-${crypto.randomUUID()}`,
                shortName: "IIK",
                name: "Institutt for informasjonssikkerhet og kommunikasjonsteknologi",
            },
        ])
        .returning();

    if (!idi || !iik) throw new Error("Failed to create test institutes");
    return { idi, iik };
}

describe("event institute restriction", () => {
    integrationTest(
        "a student at the event's institute may register",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const { iik } = await setupInstitutes(ctx);

            const digsec = await ctx.utils.createTestGroup({
                slug: `digsec-${Date.now()}`,
                name: "Digital infrastruktur og cybersikkerhet",
                type: "STUDY",
            });
            await ctx.db
                .update(schema.group)
                .set({ instituteId: iik.id })
                .where(eq(schema.group.slug, digsec.slug));

            const event = await ctx.utils.createTestEvent({
                slug: `iik-event-${Date.now()}`,
                restrictedToInstituteId: iik.id,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            await ctx.db.insert(schema.groupMembership).values({
                userId: user.id,
                groupSlug: digsec.slug,
            });

            const client = await ctx.utils.clientForUser(user);
            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "a student at another institute is rejected",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const { idi, iik } = await setupInstitutes(ctx);

            const dataing = await ctx.utils.createTestGroup({
                slug: `dataing-${Date.now()}`,
                name: "Dataingeniør",
                type: "STUDY",
            });
            await ctx.db
                .update(schema.group)
                .set({ instituteId: idi.id })
                .where(eq(schema.group.slug, dataing.slug));

            const event = await ctx.utils.createTestEvent({
                slug: `iik-only-${Date.now()}`,
                restrictedToInstituteId: iik.id,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            await ctx.db.insert(schema.groupMembership).values({
                userId: user.id,
                groupSlug: dataing.slug,
            });

            const client = await ctx.utils.clientForUser(user);
            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(403);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            expect(rows).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "a member with no institute at all is rejected",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const { iik } = await setupInstitutes(ctx);

            const event = await ctx.utils.createTestEvent({
                slug: `iik-strict-${Date.now()}`,
                restrictedToInstituteId: iik.id,
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

            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "an unrestricted event stays open to everyone",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await setupInstitutes(ctx);

            const event = await ctx.utils.createTestEvent({
                slug: `open-event-${Date.now()}`,
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
        },
        500_000,
    );

    integrationTest(
        "the event detail response names the institute it is reserved for",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const { iik } = await setupInstitutes(ctx);

            const event = await ctx.utils.createTestEvent({
                slug: `iik-detail-${Date.now()}`,
                restrictedToInstituteId: iik.id,
            });

            const client = ctx.utils.client();
            const response = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toMatchObject({
                restrictedToInstitute: {
                    slug: iik.slug,
                    shortName: "IIK",
                },
            });
        },
        500_000,
    );
});
