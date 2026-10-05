import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

const FEIDE_IMAGE = "https://photon.tihlde.org/api/assets/feide.webp";
const UPLOADED_IMAGE = "https://photon.tihlde.org/api/assets/uploads/me.webp";

async function memberWithUploadedAvatar(ctx: IntegrationTestContext) {
    const user = await ctx.utils.createTestUser();
    await ctx.db
        .update(schema.user)
        .set({ image: FEIDE_IMAGE })
        .where(eq(schema.user.id, user.id));
    await ctx.db.insert(schema.userSettings).values({
        userId: user.id,
        gender: "other",
        acceptsEventRules: true,
        receiveMailCommunication: false,
        imageUrl: UPLOADED_IMAGE,
    });
    return user;
}

describe("uploaded avatar in lists", () => {
    integrationTest(
        "verv holders show the uploaded avatar",
        async ({ ctx }) => {
            const holder = await memberWithUploadedAvatar(ctx);
            const viewer = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(viewer);
            const group = await ctx.utils.createTestGroup();

            await ctx.db.insert(schema.groupMembership).values({
                userId: holder.id,
                groupSlug: group.slug,
                role: "member",
            });
            const [position] = await ctx.db
                .insert(schema.groupPosition)
                .values({ groupSlug: group.slug, name: "Kasserer" })
                .returning();
            await ctx.db.insert(schema.groupPositionHolder).values({
                positionId: position!.id,
                userId: holder.id,
            });

            const response = await client.api.groups[
                ":groupSlug"
            ].positions.$get({ param: { groupSlug: group.slug } });
            expect(response.status).toBe(200);
            const [listed] = await response.json();
            expect(listed!.holders).toEqual([
                expect.objectContaining({
                    userId: holder.id,
                    image: UPLOADED_IMAGE,
                }),
            ]);
        },
        500_000,
    );

    integrationTest(
        "group members show the uploaded avatar",
        async ({ ctx }) => {
            const member = await memberWithUploadedAvatar(ctx);
            const client = await ctx.utils.clientForUser(member);
            const group = await ctx.utils.createTestGroup();
            await ctx.db.insert(schema.groupMembership).values({
                userId: member.id,
                groupSlug: group.slug,
                role: "member",
            });

            const response = await client.api.groups[":groupSlug"].members.$get(
                { param: { groupSlug: group.slug } },
            );
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(JSON.stringify(body)).toContain(UPLOADED_IMAGE);
            expect(JSON.stringify(body)).not.toContain(FEIDE_IMAGE);
        },
        500_000,
    );

    integrationTest(
        "registrations and reactions show the uploaded avatar",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const member = await memberWithUploadedAvatar(ctx);
            const client = await ctx.utils.clientForUser(member);
            const event = await ctx.utils.createTestEvent({
                reactionsAllowed: true,
            });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: member.id,
                status: "registered",
            });
            await ctx.db.insert(schema.eventReaction).values({
                eventId: event.id,
                userId: member.id,
                emoji: "👍",
            });

            const registrations = await client.api.event[
                ":eventId"
            ].registration.$get({ param: { eventId: event.id }, query: {} });
            expect(registrations.status).toBe(200);
            const registrationsBody = JSON.stringify(
                await registrations.json(),
            );
            expect(registrationsBody).toContain(UPLOADED_IMAGE);
            expect(registrationsBody).not.toContain(FEIDE_IMAGE);

            const detail = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(detail.status).toBe(200);
            const detailBody = await detail.json();
            if (typeof detailBody === "string") throw new Error(detailBody);
            expect(detailBody.reactions[0]?.user.image).toBe(UPLOADED_IMAGE);
        },
        500_000,
    );
});
