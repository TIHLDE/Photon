import { route } from "~/lib/route";
import { accountLinkHelpRoute } from "./help";

export const accountLinkRoutes = route().route("/", accountLinkHelpRoute);
