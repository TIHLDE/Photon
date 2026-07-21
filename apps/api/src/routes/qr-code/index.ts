import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { listRoute } from "./list";

export const qrCodeRoutes = route()
    .route("/", listRoute)
    .route("/", createRoute)
    .route("/", deleteRoute);
