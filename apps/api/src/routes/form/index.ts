import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { statisticsRoute } from "./statistics";
import { createSubmissionRoute } from "./submission/create";
import { deleteSubmissionWithReasonRoute } from "./submission/delete";
import { downloadSubmissionsRoute } from "./submission/download";
import { getSubmissionRoute } from "./submission/get";
import { listSubmissionsRoute } from "./submission/list";
import { listOwnSubmissionsRoute } from "./submission/mine";
import { updateRoute } from "./update";

export const formRoutes = route()
    // Form CRUD
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", getRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)

    // Form statistics
    .route("/", statisticsRoute)

    // Submissions. `/submissions/download` og `/submissions/me` må stå før
    // `/submissions/:id`, ellers matcher id-ruten først og ordet brukes som
    // innsendings-id.
    .route("/", createSubmissionRoute)
    .route("/", listSubmissionsRoute)
    .route("/", downloadSubmissionsRoute)
    .route("/", listOwnSubmissionsRoute)
    .route("/", getSubmissionRoute)
    .route("/", deleteSubmissionWithReasonRoute);
