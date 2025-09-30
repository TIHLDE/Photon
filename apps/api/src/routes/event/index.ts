import { Hono } from "hono";
import { createRoute } from "./create";
import { listRoute } from "./list";
import { updateRoute } from "./update";
import { deleteRoute } from "./delete";
import { updateFavoriteRoute as updateFavoriteEventsRoute } from "./favorite/update";
import { getFavoriteEventsRoute } from "./favorite/get";
import { registerToEventRoute } from "./registration/create";
import { getAllRegistrationsForEventsRoute } from "./registration/list";
import { deleteEventRegistrationRoute } from "./registration/delete";
import { createPaymentRoute } from "./payment/create";
import { paymentWebhookRoute } from "./payment/webhook";

export const eventRoutes = new Hono()
    // Event routes
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)

    // Favorites
    .route("/favorite", updateFavoriteEventsRoute)
    .route("/favorite", getFavoriteEventsRoute)

    // Registration
    // url prefix is delegated because we capture the :eventId there
    // i.e. /:eventId/registration
    .route("/", registerToEventRoute)
    .route("/", getAllRegistrationsForEventsRoute)
    .route("/", deleteEventRegistrationRoute)

    // Payment
    .route("/", createPaymentRoute)
    .route("/", paymentWebhookRoute);
