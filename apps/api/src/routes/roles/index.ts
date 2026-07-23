import { route } from "~/lib/route";
import { assignRoleRoute, unassignRoleRoute } from "./assign";
import { createRoleRoute } from "./create";
import { deleteRoleRoute } from "./delete";
import { listRolesRoute } from "./list";
import { updateRoleRoute } from "./update";

export const rolesRoutes = route()
    .route("/", listRolesRoute)
    .route("/", createRoleRoute)
    .route("/", updateRoleRoute)
    .route("/", deleteRoleRoute)
    .route("/", assignRoleRoute)
    .route("/", unassignRoleRoute);
