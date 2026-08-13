import { PUSH_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { sendNotification } from "~/lib/notification";
import {
    type PushJobData,
    deliverPushNotification,
} from "~/lib/notification/push";
import { integrationTest } from "~/test/config/integration";

describe("notification list", () => {
    integrationTest(
        "filters on read state and counts unread without fetching them",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.db.insert(schema.notification).values([
                {
                    userId: user.id,
                    title: "Ulest 1",
                    description: "",
                    isRead: false,
                },
                {
                    userId: user.id,
                    title: "Ulest 2",
                    description: "",
                    isRead: false,
                },
                {
                    userId: user.id,
                    title: "Lest",
                    description: "",
                    isRead: true,
                },
            ]);

            const all = await client.api.notification.$get({ query: {} });
            expect(all.status).toBe(200);
            expect((await all.json()).totalCount).toBe(3);

            /**
             * The profile badge asks for a single row and reads totalCount, so
             * the count must reflect the filter and not the page size. A
             * `z.coerce.boolean()` query param would read "false" as true and
             * make this return the read one instead.
             */
            const unread = await client.api.notification.$get({
                query: { isRead: "false", pageSize: "1" },
            });
            const unreadBody = await unread.json();
            expect(unreadBody.totalCount).toBe(2);
            expect(unreadBody.items).toHaveLength(1);
            expect(unreadBody.items[0]?.isRead).toBe(false);

            const read = await client.api.notification.$get({
                query: { isRead: "true" },
            });
            const readBody = await read.json();
            expect(readBody.totalCount).toBe(1);
            expect(readBody.items[0]?.title).toBe("Lest");
        },
    );

    integrationTest(
        "counts only the caller's notifications",
        async ({ ctx }) => {
            const mine = await ctx.utils.createTestUser();
            const theirs = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(mine);

            await ctx.db.insert(schema.notification).values([
                {
                    userId: theirs.id,
                    title: "Ikke min",
                    description: "",
                    isRead: false,
                },
            ]);

            const unread = await client.api.notification.$get({
                query: { isRead: "false" },
            });
            expect((await unread.json()).totalCount).toBe(0);
        },
    );
});

describe("push notification devices", () => {
    integrationTest(
        "registering an already-known token moves it to the new user",
        async ({ ctx }) => {
            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();
            const token = "ExponentPushToken[delt-telefon]";

            const firstClient = await ctx.utils.clientForUser(first);
            const registered = await firstClient.api.notification.device.$post({
                json: { token, platform: "ios" },
            });
            expect(registered.status).toBe(200);

            const secondClient = await ctx.utils.clientForUser(second);
            await secondClient.api.notification.device.$post({
                json: { token, platform: "ios" },
            });

            // One row, owned by whoever logged in last — otherwise the phone
            // would keep buzzing with the previous owner's notifications.
            const devices = await ctx.db.query.notificationDevice.findMany();
            expect(devices).toHaveLength(1);
            expect(devices[0]?.userId).toBe(second.id);
        },
    );

    integrationTest(
        "unregistering only touches the caller's own token",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const stranger = await ctx.utils.createTestUser();
            const token = "ExponentPushToken[min-telefon]";

            const ownerClient = await ctx.utils.clientForUser(owner);
            await ownerClient.api.notification.device.$post({
                json: { token, platform: "android" },
            });

            const strangerClient = await ctx.utils.clientForUser(stranger);
            const attempt =
                await strangerClient.api.notification.device.$delete({
                    json: { token },
                });
            expect(attempt.status).toBe(200);
            expect(
                await ctx.db.query.notificationDevice.findMany(),
            ).toHaveLength(1);

            await ownerClient.api.notification.device.$delete({
                json: { token },
            });
            expect(
                await ctx.db.query.notificationDevice.findMany(),
            ).toHaveLength(0);
        },
    );

    integrationTest("queues a push for every notification", async ({ ctx }) => {
        const user = await ctx.utils.createTestUser();

        await sendNotification(
            {
                userId: user.id,
                title: "Du fikk plass",
                description: "Du er flyttet opp fra ventelisten",
                link: "/arrangementer/123",
                sendTo: { website: true, email: false },
            },
            ctx,
        );

        const jobs = await ctx.queue
            .getQueue<PushJobData>(PUSH_QUEUE_NAME)
            .getJobs();
        expect(jobs).toHaveLength(1);
        expect(jobs[0]?.data).toMatchObject({
            userId: user.id,
            title: "Du fikk plass",
            body: "Du er flyttet opp fra ventelisten",
            link: "/arrangementer/123",
        });

        // The push points at the row it was created from, so a tap in the app
        // can mark that one as read without guessing from the title.
        const [stored] = await ctx.db.query.notification.findMany();
        expect(stored).toBeDefined();
        expect(jobs[0]?.data.notificationId).toBe(stored?.id);
    });

    integrationTest(
        "queues a push without a notification id when nothing is stored",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();

            await sendNotification(
                {
                    userId: user.id,
                    title: "Kun push",
                    description: "Ingen rad å markere som lest",
                    sendTo: { website: false, email: false },
                },
                ctx,
            );

            const jobs = await ctx.queue
                .getQueue<PushJobData>(PUSH_QUEUE_NAME)
                .getJobs();
            expect(jobs).toHaveLength(1);
            expect(jobs[0]?.data.notificationId).toBeNull();
            expect(await ctx.db.query.notification.findMany()).toHaveLength(0);
        },
    );

    integrationTest(
        "sends to every device and drops tokens Expo has retired",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.notificationDevice).values([
                {
                    userId: user.id,
                    token: "ExponentPushToken[ok]",
                    platform: "ios",
                },
                {
                    userId: user.id,
                    token: "ExponentPushToken[avinstallert]",
                    platform: "android",
                },
            ]);

            const requests: unknown[] = [];
            const originalFetch = globalThis.fetch;
            globalThis.fetch = (async (_url: string, init: RequestInit) => {
                const messages = JSON.parse(String(init.body)) as {
                    to: string;
                }[];
                requests.push(messages);

                return new Response(
                    JSON.stringify({
                        data: messages.map((message) =>
                            message.to.includes("avinstallert")
                                ? {
                                      status: "error",
                                      message: "not registered",
                                      details: { error: "DeviceNotRegistered" },
                                  }
                                : { status: "ok", id: "ticket" },
                        ),
                    }),
                    { status: 200 },
                );
            }) as typeof globalThis.fetch;

            try {
                await deliverPushNotification(
                    {
                        userId: user.id,
                        title: "Ny bot",
                        body: "Du har fått en bot",
                        link: "/grupper/drift/boter",
                        notificationId: "varsel-123",
                    },
                    ctx,
                );
            } finally {
                globalThis.fetch = originalFetch;
            }

            expect(requests).toHaveLength(1);

            // Both the link and the id have to survive into the Expo payload —
            // they are all the app gets to act on when the push is tapped.
            const sent = requests[0] as { data: unknown }[];
            expect(sent[0]?.data).toEqual({
                link: "/grupper/drift/boter",
                notificationId: "varsel-123",
            });

            // The dead token is deleted rather than retried: Expo rejects it
            // forever once the app is gone from the device.
            const remaining = await ctx.db.query.notificationDevice.findMany();
            expect(remaining).toHaveLength(1);
            expect(remaining[0]?.token).toBe("ExponentPushToken[ok]");
        },
    );
});
