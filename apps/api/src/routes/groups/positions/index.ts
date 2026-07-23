import { route } from "~/lib/route";
import { assignPositionRoute } from "./assign";
import { createPositionRoute } from "./create";
import { deletePositionRoute } from "./delete";
import { listPositionsRoute } from "./list";
import { unassignPositionRoute } from "./unassign";
import { updatePositionRoute } from "./update";

export const positionsRoutes = route()
    .route("/", listPositionsRoute)
    .route("/", createPositionRoute)
    .route("/", updatePositionRoute)
    .route("/", deletePositionRoute)
    .route("/", assignPositionRoute)
    .route("/", unassignPositionRoute);
