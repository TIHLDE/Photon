import { route } from "~/lib/route";
import { createLawRoute } from "./create";
import { deleteLawRoute } from "./delete";
import { listLawsRoute } from "./list";
import { updateLawRoute } from "./update";

export const lawsRoutes = route()
    .route("/", listLawsRoute)
    .route("/", createLawRoute)
    .route("/", updateLawRoute)
    .route("/", deleteLawRoute);
