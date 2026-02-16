import { route } from "~/lib/route";
import { createFineRoute } from "./create";
import { deleteFineRoute } from "./delete";
import { getFineRoute } from "./get";
import { listFinesRoute } from "./list";
import { updateFineRoute } from "./update";

export const finesRoutes = route()
    .route("/", listFinesRoute)
    .route("/", createFineRoute)
    .route("/", getFineRoute)
    .route("/", updateFineRoute)
    .route("/", deleteFineRoute);
