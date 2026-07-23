import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { finesRoutes } from "./fines";
import { lawsRoutes } from "./laws";
import { createGroupFormRoute } from "./form/create";
import { listGroupFormsRoute } from "./form/list";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { membersRoutes } from "./members";
import { mineRoute } from "./mine";
import { positionsRoutes } from "./positions";
import { updateRoute } from "./update";

export const groupsRoutes = route()
    .route("/", listRoute)
    .route("/", mineRoute)
    .route("/", createRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)
    .route("/", getRoute)
    .route("/", finesRoutes)
    .route("/", lawsRoutes)
    .route("/", membersRoutes)
    .route("/", positionsRoutes)
    .route("/", createGroupFormRoute)
    .route("/", listGroupFormsRoute);
