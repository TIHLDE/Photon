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

    // Submissions
    .route("/", createSubmissionRoute)
    .route("/", listSubmissionsRoute)
    .route("/", getSubmissionRoute)
    .route("/", downloadSubmissionsRoute)
    .route("/", deleteSubmissionWithReasonRoute);
