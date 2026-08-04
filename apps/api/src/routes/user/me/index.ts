import { route } from "~/lib/route";
import { listUnansweredEvaluationsRoute } from "./evaluations/list";
import { settingsRoutes } from "./settings";

export const meRoutes = route()
    .route("/settings", settingsRoutes)
    .route("/", listUnansweredEvaluationsRoute);
