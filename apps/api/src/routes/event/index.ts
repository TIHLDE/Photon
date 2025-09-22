import { Hono } from "hono";
import { createRoute } from "./create";
import { listRoute } from "./list";
import { updateRoute } from "./update";
import { deleteRoute } from "./delete";

export const eventRoutes = new Hono()
    // Event routes
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute);
