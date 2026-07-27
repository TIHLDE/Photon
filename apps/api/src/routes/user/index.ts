import { route } from "~/lib/route";
import { allergyRoutes } from "./allergy";
import { listUsersRoute } from "./list";
import { meRoutes } from "./me";
import { searchUsersRoute } from "./search";

export const userRoutes = route()
    .route("/me", meRoutes)
    .route("/allergy", allergyRoutes)
    .route("/", searchUsersRoute)
    .route("/", listUsersRoute);
