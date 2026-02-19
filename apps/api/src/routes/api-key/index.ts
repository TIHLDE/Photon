import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { regenerateRoute } from "./regenerate";
import { updateRoute } from "./update";
import { validateRoute } from "./validate";

export const apiKeyRoutes = route()
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", getRoute)
    .route("/", updateRoute)
    .route("/", regenerateRoute)
    .route("/", deleteRoute)
    .route("/", validateRoute);
