import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { finesRoutes } from "./fines";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { membersRoutes } from "./members";
import { updateRoute } from "./update";
import { createGroupFormRoute } from "./form/create";
import { listGroupFormsRoute } from "./form/list";

export const groupsRoutes = route()
    .route("/", listRoute)
    .route("/", createRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)
    .route("/", getRoute)
    .route("/", finesRoutes)
    .route("/", membersRoutes)
    .route("/", createGroupFormRoute)
    .route("/", listGroupFormsRoute);
