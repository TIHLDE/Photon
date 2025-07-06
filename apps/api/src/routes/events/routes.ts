import { Hono } from "hono";
import { publicRoutes } from "./public";
import { memberRoutes } from "./member";
import { adminRoutes } from "./admin";

export const eventRoutes = new Hono()
    .route("/", adminRoutes)
    .route("/", memberRoutes)
    .route("/", publicRoutes);
