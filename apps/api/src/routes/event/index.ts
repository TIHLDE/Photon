import { Hono } from "hono";
import { createRoute } from "./create";

export const eventRoutes = new Hono()
    // Event routes
    .route("/", createRoute);
