import { route } from "~/lib/route";
import { allergyRoutes } from "./allergy";
import { getUserAllergiesRoute } from "./allergy/get-for-user";
import { updateUserAllergiesRoute } from "./allergy/update-for-user";
import { getUserRoute } from "./get";
import { listUsersRoute } from "./list";
import { meRoutes } from "./me";
import { registerUserRoute } from "./register";
import { searchUsersRoute } from "./search";
import { updateUserStatusRoute } from "./status/update";
import { updateStudyYearRoute } from "./study-year/update";

export const userRoutes = route()
    .route("/me", meRoutes)
    .route("/allergy", allergyRoutes)
    .route("/", registerUserRoute)
    .route("/", searchUsersRoute)
    .route("/", listUsersRoute)
    .route("/", updateStudyYearRoute)
    .route("/", getUserAllergiesRoute)
    .route("/", updateUserAllergiesRoute)
    .route("/", updateUserStatusRoute)
    // Last: `/:id` is a catch-all and would otherwise swallow `/search`.
    .route("/", getUserRoute);
