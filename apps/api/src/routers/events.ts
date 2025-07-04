import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { requireAuth } from "~/middleware/auth";

const userRoutes = new Hono()
    .post("/:id/register", describeRoute({}), requireAuth)
    .delete("/:id/register", describeRoute({}), requireAuth)
    .get("/:id/registration", describeRoute({}), requireAuth);

const adminRoutes = new Hono()
    .post("/", describeRoute({}))
    .put("/:id", describeRoute({}))
    .delete("/:id", describeRoute({}))
    .get("/admin/:id/waitlist", describeRoute({}))
    .post("/admin/:id/move-from-waitlist/:userId", describeRoute({}));

export const routes = new Hono()
    .get("/", describeRoute({}))
    .get("/:id", describeRoute({}))
    .route("/", userRoutes)
    .route("/", adminRoutes);
