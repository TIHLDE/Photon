import { route } from "~/lib/route";
import { getSettingsRoute } from "./get";
import { onboardRoute } from "./onboard";
import { updateSettingsRoute } from "./update";

export const settingsRoutes = route()
    .route("/", getSettingsRoute)
    .route("/", onboardRoute)
    .route("/", updateSettingsRoute);
