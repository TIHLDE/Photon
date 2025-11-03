import { route } from "../../lib/route";
import { deleteNotificationRoute } from "./delete";
import { listNotificationsRoute } from "./list";
import { markReadNotificationRoute } from "./mark-read";

export const notificationRoutes = route()
    .route("/", listNotificationsRoute)
    .route("/", deleteNotificationRoute)
    .route("/", markReadNotificationRoute);
