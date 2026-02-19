import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { createReactionRoute } from "./reactions/create";
import { deleteReactionRoute } from "./reactions/delete";
import { updateRoute } from "./update";

export const newsRoutes = route()
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", getRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)
    .route("/", createReactionRoute)
    .route("/", deleteReactionRoute);
