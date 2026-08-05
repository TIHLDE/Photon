import { route } from "~/lib/route";
import { listUnansweredEvaluationsRoute } from "./evaluations/list";
import { passwordRoutes } from "./password";
import { settingsRoutes } from "./settings";

export const meRoutes = route()
    .route("/settings", settingsRoutes)
    .route("/password", passwordRoutes)
    .route("/", listUnansweredEvaluationsRoute);
