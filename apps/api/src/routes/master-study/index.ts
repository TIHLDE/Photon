import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { studyProgramsRoute } from "./study-programs";
import { createQuoteRoute } from "./quotes/create";
import { deleteQuoteRoute } from "./quotes/delete";
import { updateQuoteRoute } from "./quotes/update";
import { updateRoute } from "./update";

export const masterStudyRoutes = route()
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", studyProgramsRoute)
    .route("/", getRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)
    .route("/", createQuoteRoute)
    .route("/", updateQuoteRoute)
    .route("/", deleteQuoteRoute);
