import { route } from "~/lib/route";
import { accountLinkHelpRoute } from "./help";
import { accountLinkSyncRoute } from "./sync";

export const accountLinkRoutes = route()
    .route("/", accountLinkHelpRoute)
    .route("/", accountLinkSyncRoute);
