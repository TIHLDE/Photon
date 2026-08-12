import { route } from "../../lib/route";
import { deleteNotificationRoute } from "./delete";
import { registerDeviceRoute, unregisterDeviceRoute } from "./device";
import { listNotificationsRoute } from "./list";
import { markReadNotificationRoute } from "./mark-read";

/**
 * The device routes are registered before the `/:id` ones on purpose: Hono
 * runs every matching handler in registration order, so `DELETE /:id` would
 * otherwise swallow `DELETE /device` and answer "notification not found".
 */
export const notificationRoutes = route()
    .route("/", registerDeviceRoute)
    .route("/", unregisterDeviceRoute)
    .route("/", listNotificationsRoute)
    .route("/", deleteNotificationRoute)
    .route("/", markReadNotificationRoute);
