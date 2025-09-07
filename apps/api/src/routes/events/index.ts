import { Hono } from "hono";
import { listRouter } from "./handlers/list";
import { getRouter } from "./handlers/get";
import { createRouter } from "./handlers/create";
import { updateRouter } from "./handlers/update";
import { removeRouter } from "./handlers/remove";
import { registrationsListRouter } from "./handlers/registrations/list";
import { registerRouter } from "./handlers/registrations/register";
import { cancelRouter } from "./handlers/registrations/cancel";
import { checkinRouter } from "./handlers/registrations/checkin";
import { feedbackListRouter } from "./handlers/feedback/list";
import { feedbackCreateRouter } from "./handlers/feedback/create";
import { paymentsListRouter } from "./handlers/payments/list";
import { paymentsCreateRouter } from "./handlers/payments/create";
import { paymentsWebhookRouter } from "./handlers/payments/webhook";

export const eventsRoutes = new Hono();

// Event routes
eventsRoutes.route("/", listRouter);
eventsRoutes.route("/", createRouter);
eventsRoutes.route("/", getRouter);
eventsRoutes.route("/", updateRouter);
eventsRoutes.route("/", removeRouter);

// Registration routes
eventsRoutes.route("/", registrationsListRouter);
eventsRoutes.route("/", registerRouter);
eventsRoutes.route("/", cancelRouter);
eventsRoutes.route("/", checkinRouter);

// Feedback routes
eventsRoutes.route("/", feedbackListRouter);
eventsRoutes.route("/", feedbackCreateRouter);

// Payment routes
eventsRoutes.route("/", paymentsWebhookRouter);
eventsRoutes.route("/", paymentsListRouter);
eventsRoutes.route("/", paymentsCreateRouter);
