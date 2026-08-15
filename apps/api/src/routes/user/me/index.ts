import { route } from "~/lib/route";
import { calendarRoutes } from "./calendar";
import { listUnansweredEvaluationsRoute } from "./evaluations/list";
import { passwordRoutes } from "./password";
import { settingsRoutes } from "./settings";

export const meRoutes = route()
    .route("/calendar", calendarRoutes)
    .route("/settings", settingsRoutes)
    .route("/password", passwordRoutes)
    .route("/", listUnansweredEvaluationsRoute);
