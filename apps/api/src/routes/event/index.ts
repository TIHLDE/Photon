import { Hono } from "hono";
import { createRoute } from "./create";
import { listRoute } from "./list";

export const eventRoutes = new Hono()
    // Event routes
    .route("/", createRoute)
    .route("/", listRoute);
