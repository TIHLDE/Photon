import { schema } from "@photon/db";
import {
    PUSH_QUEUE_NAME,
    type QueueJob,
    type WorkerLike,
} from "@photon/core/services/queue";
import { inArray } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { env } from "../env";

/** Expo's push endpoint. Takes up to 100 messages per request. */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_CHUNK_SIZE = 100;

export type PushJobData = {
    userId: string;
    title: string;
    body: string;
    /** Website-relative link, forwarded to the app so a tap can deep-link. */
    link?: string | null;
    /**
     * The stored notification this push belongs to, so a tap in the app can
     * mark exactly that one as read. Null when the caller skipped the website
     * channel and no row was written.
     */
    notificationId?: string | null;
};

type ExpoPushMessage = {
    to: string;
    title: string;
    body: string;
    data: { link?: string | null; notificationId?: string | null };
    sound: "default";
    channelId: "default";
};

type ExpoPushTicket = {
    status: "ok" | "error";
    id?: string;
    message?: string;
    details?: { error?: string };
};

/**
 * Queue a push notification for every device the user has registered.
 *
 * Enqueued rather than sent inline: `sendNotification` runs inside request
 * handlers, and some of them (fines, waitlist resolution) notify a whole list
 * of users in a loop. A round trip to Expo per user would show up directly in
 * the response time.
 */
export async function enqueuePushNotification(
    data: PushJobData,
    ctx: AppContext,
): Promise<void> {
    await ctx.queue
        .getQueue<PushJobData>(PUSH_QUEUE_NAME)
        .add("send-push", data);
}

/**
 * Queue a whole batch of pushes in one round trip.
 *
 * For the caller that notifies everyone in a resolved sign-up wave at once —
 * one `add` per member is one round trip per member.
 */
export async function enqueuePushNotifications(
    entries: PushJobData[],
    ctx: AppContext,
): Promise<void> {
    if (entries.length === 0) return;

    await ctx.queue.getQueue<PushJobData>(PUSH_QUEUE_NAME).addBulk(
        entries.map((data) => ({
            name: "send-push",
            data,
        })),
    );
}

/**
 * Deliver one queued notification to the user's devices.
 *
 * Exported for the worker and for tests; callers that just want to notify
 * somebody should use `sendNotification`.
 */
export async function deliverPushNotification(
    data: PushJobData,
    ctx: AppContext,
): Promise<void> {
    const devices = await ctx.db.query.notificationDevice.findMany({
        where: (device, { eq }) => eq(device.userId, data.userId),
        columns: { token: true },
    });

    if (devices.length === 0) return;

    const messages: ExpoPushMessage[] = devices.map((device) => ({
        to: device.token,
        title: data.title,
        body: data.body,
        data: {
            link: data.link ?? null,
            notificationId: data.notificationId ?? null,
        },
        sound: "default",
        // Android ignores sound unless the message names a channel; the app
        // creates "default" on startup.
        channelId: "default",
    }));

    const staleTokens: string[] = [];

    for (let i = 0; i < messages.length; i += EXPO_PUSH_CHUNK_SIZE) {
        const chunk = messages.slice(i, i + EXPO_PUSH_CHUNK_SIZE);
        const tickets = await sendChunk(chunk);

        tickets.forEach((ticket, index) => {
            if (ticket?.status !== "error") return;

            const token = chunk[index]?.to;
            // The device uninstalled the app or wiped the token. Expo will
            // keep rejecting it forever, so drop it instead of retrying.
            if (token && ticket.details?.error === "DeviceNotRegistered") {
                staleTokens.push(token);
                return;
            }

            console.error(
                `❌ Expo rejected a push notification: ${ticket.message ?? "unknown error"}`,
            );
        });
    }

    if (staleTokens.length > 0) {
        await ctx.db
            .delete(schema.notificationDevice)
            .where(inArray(schema.notificationDevice.token, staleTokens));
    }
}

async function sendChunk(chunk: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(env.EXPO_ACCESS_TOKEN
                ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
                : {}),
        },
        body: JSON.stringify(chunk),
    });

    if (!response.ok) {
        throw new Error(
            `Expo push request failed: ${response.status} ${await response.text()}`,
        );
    }

    const payload = (await response.json()) as { data?: ExpoPushTicket[] };
    return payload.data ?? [];
}

export function startPushNotificationWorker(ctx: AppContext): WorkerLike {
    const worker = ctx.queue.createWorker<PushJobData, void>(
        PUSH_QUEUE_NAME,
        async (job: QueueJob<PushJobData>) => {
            await deliverPushNotification(job.data, ctx);
        },
    );

    worker.on("failed", (job, err) => {
        console.error(`❌ Push job ${job?.id} failed:`, err);
    });

    worker.on("error", (err) => {
        console.error("Push worker error:", err);
    });

    return worker;
}
