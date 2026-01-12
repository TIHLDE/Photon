import { route } from "~/lib/route";
import { allergyRoutes } from "./allergy";
import { meRoutes } from "./me";

export const userRoutes = route()
    .route("/me", meRoutes)
    .route("/allergy", allergyRoutes);
