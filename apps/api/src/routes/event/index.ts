import { Hono } from "hono";
import { listRoute } from "./list";
import { getRoute } from "./get";
import { createRoute } from "./create";
import { updateRoute } from "./update";
import { removeRoute } from "./remove";

import { listRegistrationsRoute } from "./registrations/list";
import { registerRoute } from "./registrations/register";
import { cancelRoute } from "./registrations/cancel";
import { checkinRoute } from "./registrations/checkin";
import { getRegistrationRoute } from "./registrations/get";

import { createRegistrationRoute } from "./registrations/admin/create";
import { removeRegistrationRoute } from "./registrations/admin/remove";

import { listFeedbackRoute } from "./feedback/list";
import { createFeedbackRoute } from "./feedback/create";
import { getFeedbackRoute } from "./feedback/get";
import { updateFeedbackRoute } from "./feedback/update";
import { removeFeedbackRoute } from "./feedback/remove";

import { listPaymentRoute } from "./payments/list";
import { createPaymentRoute } from "./payments/create";
import { getPaymentRoute } from "./payments/get";
import { updatePaymentRoute } from "./payments/update";
import { removePaymentRoute } from "./payments/remove";
import { paymentWebhookRoute } from "./payments/webhook";

export const eventRoutes = new Hono();

// Event routes
eventRoutes.route("/", listRoute);
eventRoutes.route("/", createRoute);
eventRoutes.route("/", getRoute);
eventRoutes.route("/", updateRoute);
eventRoutes.route("/", removeRoute);

// Registration routes
eventRoutes.route("/:id/registration", getRegistrationRoute);
eventRoutes.route("/:id/registration", listRegistrationsRoute);
eventRoutes.route("/:id/registration", registerRoute);
eventRoutes.route("/:id/registration", cancelRoute);
eventRoutes.route("/:id/registration", checkinRoute);

// Admin registration routes
eventRoutes.route("/:id/registration", createRegistrationRoute);
eventRoutes.route("/:id/registration", removeRegistrationRoute);

// Feedback routes
eventRoutes.route("/:id/feedback", listFeedbackRoute);
eventRoutes.route("/:id/feedback", createFeedbackRoute);
eventRoutes.route("/:id/feedback", getFeedbackRoute);
eventRoutes.route("/:id/feedback", updateFeedbackRoute);
eventRoutes.route("/:id/feedback", removeFeedbackRoute);

// Payment routes
eventRoutes.route("/:id/payment", listPaymentRoute);
eventRoutes.route("/:id/payment", createPaymentRoute);
eventRoutes.route("/:id/payment", getPaymentRoute);
eventRoutes.route("/:id/payment", updatePaymentRoute);
eventRoutes.route("/:id/payment", removePaymentRoute);
eventRoutes.route("/payment", paymentWebhookRoute);
