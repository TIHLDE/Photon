import { Hono } from "hono";
import { listRouter } from "./list";
import { getRouter } from "./get";
import { createRouter } from "./create";
import { updateRouter } from "./update";
import { removeRouter } from "./remove";
import { registrationsRouter } from "./registrations";
import { feedbackRouter } from "./feedback";
import { paymentsRouter } from "./payments";
import { paymentsWebhookRouter } from "./payments/webhook";

export const eventRoutes = new Hono();

// Event routes
eventRoutes.route("/", listRouter);
eventRoutes.route("/", createRouter);
eventRoutes.route("/", getRouter);
eventRoutes.route("/", updateRouter);
eventRoutes.route("/", removeRouter);

// Registration routes
eventRoutes.route("/:id/registrations", registrationsRouter);

// Feedback routes
eventRoutes.route("/:id/feedback", feedbackRouter);

// Payment routes
eventRoutes.route("/payments", paymentsWebhookRouter);
eventRoutes.route("/:id/payments", paymentsRouter);
