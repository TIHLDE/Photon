import { route } from "~/lib/route";
import { createJoinRequestRoute } from "./create";
import { listJoinRequestsRoute } from "./list";
import { handleJoinRequestRoute } from "./update";

export const joinRequestsRoutes = route()
    .route("/", createJoinRequestRoute)
    .route("/", listJoinRequestsRoute)
    .route("/", handleJoinRequestRoute);
