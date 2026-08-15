import { route } from "~/lib/route";
import { getCalendarSubscriptionRoute } from "./get";
import { regenerateCalendarSubscriptionRoute } from "./regenerate";

export const calendarRoutes = route()
    .route("/", getCalendarSubscriptionRoute)
    .route("/", regenerateCalendarSubscriptionRoute);
