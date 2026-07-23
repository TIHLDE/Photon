import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { listRoute } from "./list";
import { updateRoute } from "./update";
import { visibleRoute } from "./visible";

export const bannerRoutes = route()
    .route("/", visibleRoute)
    .route("/", listRoute)
    .route("/", createRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute);
