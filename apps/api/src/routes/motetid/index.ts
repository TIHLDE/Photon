import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoute } from "./get";
import { googleCallbackRoute } from "./google-callback";
import { googleConnectRoute } from "./google-connect";
import { listRoute } from "./list";
import { saveAvailabilityRoute } from "./save-availability";
import { syncCalendarRoute } from "./sync-calendar";

export const motetidRoutes = route()
    .route("/", listRoute)
    .route("/", createRoute)
    .route("/", getRoute)
    .route("/", saveAvailabilityRoute)
    .route("/", deleteRoute)
    .route("/", googleConnectRoute)
    .route("/", googleCallbackRoute)
    .route("/", syncCalendarRoute);
