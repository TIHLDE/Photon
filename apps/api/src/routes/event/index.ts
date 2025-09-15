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

export const eventRoutes = new Hono()

    // Event routes
    .route("/", listRoute)
    .route("/", createRoute)
    .route("/", getRoute)
    .route("/", updateRoute)
    .route("/", removeRoute)

    // Registration routes
    .route("/:id/registration", getRegistrationRoute)
    .route("/:id/registration", listRegistrationsRoute)
    .route("/:id/registration", registerRoute)
    .route("/:id/registration", cancelRoute)
    .route("/:id/registration", checkinRoute)

    // Admin registration routes
    .route("/:id/registration", createRegistrationRoute)
    .route("/:id/registration", removeRegistrationRoute)

    // Feedback routes
    .route("/:id/feedback", listFeedbackRoute)
    .route("/:id/feedback", createFeedbackRoute)
    .route("/:id/feedback", getFeedbackRoute)
    .route("/:id/feedback", updateFeedbackRoute)
    .route("/:id/feedback", removeFeedbackRoute)

    // Payment routes
    .route("/:id/payment", listPaymentRoute)
    .route("/:id/payment", createPaymentRoute)
    .route("/:id/payment", getPaymentRoute)
    .route("/:id/payment", updatePaymentRoute)
    .route("/:id/payment", removePaymentRoute)
    .route("/payment", paymentWebhookRoute);
