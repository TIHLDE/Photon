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

export const eventsRoutes = new Hono();

// Event routes
eventsRoutes.route("/", listRouter);
eventsRoutes.route("/", createRouter);
eventsRoutes.route("/", getRouter);
eventsRoutes.route("/", updateRouter);
eventsRoutes.route("/", removeRouter);

// Registration routes
eventsRoutes.route("/:id/registrations", registrationsRouter);

// Feedback routes
eventsRoutes.route("/:id/feedback", feedbackRouter);

// Payment routes
eventsRoutes.route("/payments", paymentsWebhookRouter);
eventsRoutes.route("/:id/payments", paymentsRouter);
