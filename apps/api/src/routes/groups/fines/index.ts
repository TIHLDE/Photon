import { route } from "~/lib/route";
import { batchUpdateFinesRoute, batchUpdateUserFinesRoute } from "./batch";
import { createFineRoute } from "./create";
import { deleteFineRoute } from "./delete";
import { getFineRoute } from "./get";
import { getFineImageRoute } from "./image";
import { listFinesRoute } from "./list";
import { fineStatisticsRoute } from "./statistics";
import { updateFineRoute } from "./update";
import { listFineUsersRoute } from "./users";

/**
 * Order matters: `/fines/statistics` and `/fines/users` are literal paths that
 * `GET /fines/:fineId` would otherwise swallow, and `/fines/batch` would be
 * read as a fine ID by `PATCH /fines/:fineId`. The literal routes go first.
 */
export const finesRoutes = route()
    .route("/", listFinesRoute)
    .route("/", createFineRoute)
    .route("/", fineStatisticsRoute)
    .route("/", listFineUsersRoute)
    .route("/", batchUpdateFinesRoute)
    .route("/", batchUpdateUserFinesRoute)
    .route("/", getFineImageRoute)
    .route("/", getFineRoute)
    .route("/", updateFineRoute)
    .route("/", deleteFineRoute);
