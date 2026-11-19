import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import { logger } from "~/lib/logger";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

const STRANGER_ALLERGY = "stranger-only-allergy";
const VOLUNTEER_ALLERGY = "volunteer-allergy";

async function setup(ctx: IntegrationTestContext) {
    await ctx.utils.setupGroups();
    await ctx.utils.setupEventCategories();

    const group = await ctx.utils.createTestGroup({ slug: "brettspill" });
    const leader = await ctx.utils.createTestUser();
    await ctx.db
        .update(schema.group)
        .set({ leaderPermissions: ["events:update"] })
        .where(eq(schema.group.slug, group.slug));
    await ctx.db.insert(schema.groupMembership).values({
        userId: leader.id,
        groupSlug: group.slug,
        role: "leader",
    });

    const event = await ctx.utils.createTestEvent({
        organizerGroupSlug: group.slug,
    });

    return {
        event,
        leader,
        client: await ctx.utils.clientForUser(leader),
    };
}

async function memberWithAllergy(ctx: IntegrationTestContext, allergy: string) {
    const member = await ctx.utils.createTestUser();
    await ctx.db
        .insert(schema.userSettings)
        .values({
            userId: member.id,
            gender: "other",
            allowsPhotosByDefault: true,
            acceptsEventRules: true,
            receiveMailCommunication: false,
            isOnboarded: true,
            customAllergies: [allergy],
            allergiesConfirmedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: schema.userSettings.userId,
            set: {
                customAllergies: [allergy],
                allergiesConfirmedAt: new Date(),
            },
        });
    return member;
}

describe("allergies of people an organiser added", () => {
    integrationTest(
        "adding a stranger reveals counts, never what the allergy is",
        async ({ ctx }) => {
            const { event, client } = await setup(ctx);
            const stranger = await memberWithAllergy(ctx, STRANGER_ALLERGY);

            const added = await client.api.event[":eventId"].registration[
                ":userId"
            ].$post({
                param: { eventId: event.id, userId: stranger.id },
                json: {},
            });
            expect(added.status).toBe(200);

            const response = await client.api.event[":eventId"].allergies.$get({
                param: { eventId: event.id },
            });
            expect(response.status).toBe(200);
            const body = await response.json();

            expect(JSON.stringify(body)).not.toContain(STRANGER_ALLERGY);
            expect(body.participants).toEqual([]);
            expect(body.summary).toEqual([]);
            expect(body.totalParticipants).toBe(1);
            expect(body.withAllergies).toBe(1);
            expect(body.organizerAddedNames).toEqual([stranger.name]);
            expect(body.organizerAddedWithAllergies).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "someone who signed up themselves keeps full detail beside an added stranger",
        async ({ ctx }) => {
            const { event, client } = await setup(ctx);
            const stranger = await memberWithAllergy(ctx, STRANGER_ALLERGY);
            const volunteer = await memberWithAllergy(ctx, VOLUNTEER_ALLERGY);

            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: volunteer.id,
                status: "registered",
            });
            await client.api.event[":eventId"].registration[":userId"].$post({
                param: { eventId: event.id, userId: stranger.id },
                json: {},
            });

            const response = await client.api.event[":eventId"].allergies.$get({
                param: { eventId: event.id },
            });
            const body = await response.json();

            expect(body.participants.map((p) => p.userId)).toEqual([
                volunteer.id,
            ]);
            expect(body.summary.map((entry) => entry.label)).toEqual([
                VOLUNTEER_ALLERGY,
            ]);
            expect(JSON.stringify(body)).not.toContain(STRANGER_ALLERGY);
            expect(body.totalParticipants).toBe(2);
            expect(body.withAllergies).toBe(2);
            expect(body.organizerAddedNames).toEqual([stranger.name]);
        },
        500_000,
    );

    integrationTest(
        "re-adding someone whose own sign-up was cancelled marks the row as added",
        async ({ ctx }) => {
            const { event, client } = await setup(ctx);
            const member = await memberWithAllergy(ctx, STRANGER_ALLERGY);
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: member.id,
                status: "cancelled",
            });

            const added = await client.api.event[":eventId"].registration[
                ":userId"
            ].$post({
                param: { eventId: event.id, userId: member.id },
                json: {},
            });
            expect(added.status).toBe(200);

            const row = await ctx.db.query.eventRegistration.findFirst({
                where: { eventId: event.id, userId: member.id },
            });
            expect(row?.status).toBe("registered");
            expect(row?.addedByOrganizer).toBe(true);

            const allergies = await client.api.event[":eventId"].allergies.$get(
                { param: { eventId: event.id } },
            );
            expect(JSON.stringify(await allergies.json())).not.toContain(
                STRANGER_ALLERGY,
            );
        },
        500_000,
    );

    integrationTest(
        "a member who later signs up themselves on the same row is no longer treated as added",
        async ({ ctx }) => {
            const { event, client } = await setup(ctx);
            const member = await ctx.utils.createTestUser();
            await ctx.utils.acceptEventRules(member.id);
            await ctx.utils.giveUserPermissions(member, [
                "events:registrations:create",
            ]);

            await client.api.event[":eventId"].registration[":userId"].$post({
                param: { eventId: event.id, userId: member.id },
                json: {},
            });
            await ctx.db
                .update(schema.eventRegistration)
                .set({ status: "cancelled" })
                .where(eq(schema.eventRegistration.userId, member.id));

            const memberClient = await ctx.utils.clientForUser(member);
            const signedUp = await memberClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(signedUp.status).toBe(200);

            const row = await ctx.db.query.eventRegistration.findFirst({
                where: { eventId: event.id, userId: member.id },
            });
            expect(row?.status).toBe("pending");
            expect(row?.addedByOrganizer).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "reading the list is logged with who read it, not what they saw",
        async ({ ctx }) => {
            const { event, leader, client } = await setup(ctx);
            const volunteer = await memberWithAllergy(ctx, VOLUNTEER_ALLERGY);
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: volunteer.id,
                status: "registered",
            });

            const logged: unknown[][] = [];
            const createChild = logger.child.bind(logger);
            const spy = vi.spyOn(logger, "child").mockImplementation(((
                ...args: Parameters<typeof logger.child>
            ) => {
                const child = createChild(...args);
                const info = child.info.bind(child);
                child.info = ((...entry: unknown[]) => {
                    logged.push(entry);
                    return (info as (...a: unknown[]) => void)(...entry);
                }) as typeof child.info;
                return child;
            }) as typeof logger.child);

            try {
                const response = await client.api.event[
                    ":eventId"
                ].allergies.$get({ param: { eventId: event.id } });
                expect(response.status).toBe(200);
            } finally {
                spy.mockRestore();
            }

            const access = logged.find(
                ([first]) =>
                    typeof first === "object" &&
                    first !== null &&
                    "allergyAccess" in first,
            );
            expect(access?.[0]).toMatchObject({
                allergyAccess: {
                    viewerId: leader.id,
                    eventId: event.id,
                    participantsShown: 1,
                },
            });
            expect(JSON.stringify(access)).not.toContain(VOLUNTEER_ALLERGY);
        },
        500_000,
    );
});
