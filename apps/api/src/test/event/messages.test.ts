import type { EmailQueueJobData } from "@photon/core/services/email";
import { EMAIL_QUEUE_NAME, PUSH_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import type { RegistrationStatus } from "@photon/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

async function emailJobs(ctx: IntegrationTestContext) {
    const jobs = await ctx.queue.getQueue(EMAIL_QUEUE_NAME).getJobs();
    return jobs.map((job) => job.data as EmailQueueJobData);
}

async function pushJobs(ctx: IntegrationTestContext) {
    const jobs = await ctx.queue.getQueue(PUSH_QUEUE_NAME).getJobs();
    return jobs.map(
        (job) => job.data as { userId: string; title: string; link?: string },
    );
}

async function setup(ctx: IntegrationTestContext) {
    await ctx.utils.setupGroups();
    await ctx.utils.setupEventCategories();

    const arranger = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(arranger, ["events:update"]);
    const client = await ctx.utils.clientForUser(arranger);

    const event = await ctx.utils.createTestEvent({
        title: "Julebord",
        organizerGroupSlug: "index",
    });

    async function register(status: RegistrationStatus) {
        const user = await ctx.utils.createTestUser();
        await ctx.db.insert(schema.eventRegistration).values({
            eventId: event.id,
            userId: user.id,
            status,
        });
        return user;
    }

    return { arranger, client, event, register };
}

const content = {
    title: "Bussen går 17:00",
    body: "Vi samles ved hovedinngangen.\nHusk varme klær.",
};

describe("event messages", () => {
    integrationTest(
        "reach everyone holding a spot over all three channels, and nobody else",
        async ({ ctx }) => {
            const { client, event, register } = await setup(ctx);

            const holders = [
                await register("registered"),
                await register("attended"),
                await register("no_show"),
            ];
            await register("waitlisted");
            await register("pending");
            await register("cancelled");

            const response = await client.api.event[":eventId"].messages.$post({
                param: { eventId: event.id },
                json: content,
            });
            expect(response.status).toBe(201);
            expect(await response.json()).toMatchObject({
                title: content.title,
                recipientCount: 3,
            });

            const holderIds = holders.map((u) => u.id).sort();

            const rows = await ctx.db.query.notification.findMany({});
            expect(rows.map((r) => r.userId).sort()).toEqual(holderIds);
            for (const row of rows) {
                expect(row.title).toBe("Julebord: Bussen går 17:00");
                expect(row.description).toBe(content.body);
                expect(row.link).toBe(`/arrangementer/${event.slug}`);
            }

            const emails = await emailJobs(ctx);
            expect(emails.map((e) => e.options.to).sort()).toEqual(
                holders.map((u) => u.email).sort(),
            );
            expect(emails[0]?.options.subject).toBe(
                "Julebord: Bussen går 17:00",
            );
            expect(
                emails[0]?.content.type === "html" && emails[0].content.html,
            ).toContain("Husk varme klær.");

            const pushes = await pushJobs(ctx);
            expect(pushes.map((p) => p.userId).sort()).toEqual(holderIds);
        },
        500_000,
    );

    integrationTest(
        "are listed newest first with the count at the time, and the live count",
        async ({ ctx }) => {
            const { arranger, client, event, register } = await setup(ctx);
            await register("registered");

            await client.api.event[":eventId"].messages.$post({
                param: { eventId: event.id },
                json: content,
            });
            await register("registered");
            await client.api.event[":eventId"].messages.$post({
                param: { eventId: event.id },
                json: { title: "Nytt rom", body: "Vi er i A4-112." },
            });

            const response = await client.api.event[":eventId"].messages.$get({
                param: { eventId: event.id },
            });
            expect(response.status).toBe(200);
            const list = await response.json();

            expect(list.recipientCount).toBe(2);
            expect(list.messages).toHaveLength(2);
            expect(list.messages[0]).toMatchObject({
                title: "Nytt rom",
                recipientCount: 2,
                sentBy: { id: arranger.id },
            });
            expect(list.messages[1]).toMatchObject({
                title: content.title,
                recipientCount: 1,
            });
        },
        500_000,
    );

    integrationTest(
        "refuse the same message twice within a minute",
        async ({ ctx }) => {
            const { client, event, register } = await setup(ctx);
            await register("registered");

            const send = () =>
                client.api.event[":eventId"].messages.$post({
                    param: { eventId: event.id },
                    json: content,
                });

            expect((await send()).status).toBe(201);
            expect((await send()).status).toBe(409);

            const saved = await ctx.db.query.eventMessage.findMany({});
            expect(saved).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "refuse to send when nobody holds a spot",
        async ({ ctx }) => {
            const { client, event, register } = await setup(ctx);
            await register("waitlisted");

            const response = await client.api.event[":eventId"].messages.$post({
                param: { eventId: event.id },
                json: content,
            });
            expect(response.status).toBe(400);

            expect(await ctx.db.query.eventMessage.findMany({})).toHaveLength(
                0,
            );
            expect(await emailJobs(ctx)).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "are only for those who may edit the event",
        async ({ ctx }) => {
            const { event, register } = await setup(ctx);
            await register("registered");

            const outsider = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(outsider, [
                "events:registrations:view",
            ]);
            const outsiderClient = await ctx.utils.clientForUser(outsider);

            const send = await outsiderClient.api.event[
                ":eventId"
            ].messages.$post({
                param: { eventId: event.id },
                json: content,
            });
            expect(send.status).toBe(403);

            const list = await outsiderClient.api.event[
                ":eventId"
            ].messages.$get({ param: { eventId: event.id } });
            expect(list.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "send replies to the contact person, then to the arranging group",
        async ({ ctx }) => {
            const { client, event, register } = await setup(ctx);
            await register("registered");

            await ctx.db
                .update(schema.group)
                .set({ contactEmail: "index@tihlde.org" })
                .where(eq(schema.group.slug, "index"));

            await client.api.event[":eventId"].messages.$post({
                param: { eventId: event.id },
                json: content,
            });
            expect((await emailJobs(ctx))[0]?.options.replyTo).toBe(
                "index@tihlde.org",
            );

            const contact = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.event)
                .set({ contactPersonId: contact.id })
                .where(eq(schema.event.id, event.id));

            await client.api.event[":eventId"].messages.$post({
                param: { eventId: event.id },
                json: { ...content, title: "Andre melding" },
            });
            const replyTos = (await emailJobs(ctx)).map(
                (e) => e.options.replyTo,
            );
            expect(replyTos).toContain(contact.email);
        },
        500_000,
    );

    integrationTest(
        "test sends go to the caller only, by email and push, and leave no trace",
        async ({ ctx }) => {
            const { arranger, client, event, register } = await setup(ctx);
            await register("registered");

            const response = await client.api.event[
                ":eventId"
            ].messages.test.$post({
                param: { eventId: event.id },
                json: content,
            });
            expect(response.status).toBe(204);

            const emails = await emailJobs(ctx);
            expect(emails).toHaveLength(1);
            expect(emails[0]?.options.to).toBe(arranger.email);
            expect(emails[0]?.options.subject).toBe(
                "[Test] Julebord: Bussen går 17:00",
            );

            const pushes = await pushJobs(ctx);
            expect(pushes).toHaveLength(1);
            expect(pushes[0]?.userId).toBe(arranger.id);

            expect(await ctx.db.query.notification.findMany({})).toHaveLength(
                0,
            );
            expect(await ctx.db.query.eventMessage.findMany({})).toHaveLength(
                0,
            );
        },
        500_000,
    );
});
