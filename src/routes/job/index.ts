import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { updateRoute } from "./update";

export const jobRoutes = route()
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", getRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute);
