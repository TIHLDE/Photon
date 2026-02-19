import { route } from "../../lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getFavoriteEventsRoute } from "./favorite/get";
import { updateFavoriteRoute as updateFavoriteEventsRoute } from "./favorite/update";
import { createEventFormRoute } from "./form/create";
import { getEventFormRoute } from "./form/get";
import { listEventFormsRoute } from "./form/list";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { createPaymentRoute } from "./payment/create";
import { paymentWebhookRoute } from "./payment/webhook";
import { registerToEventRoute } from "./registration/create";
import { deleteEventRegistrationRoute } from "./registration/delete";
import { getAllRegistrationsForEventsRoute } from "./registration/list";
import { updateRoute } from "./update";

export const eventRoutes = route()
    // Event routes
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)
    .route("/", getRoute)

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
    .route("/", paymentWebhookRoute)

    // Forms
    .route("/", createEventFormRoute)
    .route("/", listEventFormsRoute)
    .route("/", getEventFormRoute);
