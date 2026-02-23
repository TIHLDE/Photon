import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { deleteQuoteRoute } from "./quotes/delete";
import { updateQuoteRoute } from "./quotes/update";
import { updateRoute } from "./update";

export const masterStudyRoutes = route()
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", getRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)
    .route("/", updateQuoteRoute)
    .route("/", deleteQuoteRoute);
