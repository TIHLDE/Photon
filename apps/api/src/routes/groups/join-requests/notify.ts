import type { AppContext } from "~/lib/ctx";
import type { LoggerType } from "~/lib/logger";
import {
    type SendNotificationOptions,
    sendNotification,
} from "~/lib/notification";

// Sent after saving, so a failed notification must not fail the request.
export async function notifyAfterSave(
    ctx: AppContext,
    logger: LoggerType,
    notifications: SendNotificationOptions[],
): Promise<void> {
    try {
        await Promise.all(notifications.map((n) => sendNotification(n, ctx)));
    } catch (err) {
        logger.error({ err }, "Failed to send group join request notification");
    }
}
