import { route } from "~/lib/route";
import { allergyRoutes } from "./allergy";
import { getUserRoute } from "./get";
import { listUsersRoute } from "./list";
import { meRoutes } from "./me";
import { searchUsersRoute } from "./search";
import { updateStudyYearRoute } from "./study-year/update";

export const userRoutes = route()
    .route("/me", meRoutes)
    .route("/allergy", allergyRoutes)
    .route("/", searchUsersRoute)
    .route("/", listUsersRoute)
    .route("/", updateStudyYearRoute)
    // Last: `/:id` is a catch-all and would otherwise swallow `/search`.
    .route("/", getUserRoute);
