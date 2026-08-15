import { route } from "../../lib/route";
import { getCalendarFeedRoute } from "./calendar/feed";
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
import { listEventPaymentsRoute } from "./payment/list";
import { refundEventPaymentRoute } from "./payment/refund";
import { paymentWebhookRoute } from "./payment/webhook";
import { setAttendanceRoute } from "./registration/attendance";
import { getMyEventHistoryRoute } from "./registration/history";
import { registerToEventRoute } from "./registration/create";
import { deleteEventRegistrationRoute } from "./registration/delete";
import { getAllRegistrationsForEventsRoute } from "./registration/list";
import { createStrikeRoute } from "./strike/create";
import { deleteStrikeRoute } from "./strike/delete";
import { listStrikesRoute } from "./strike/list";
import { updateRoute } from "./update";

export const eventRoutes = route()
    // Strikes (registered before "/:eventId" so the static /strikes path wins)
    .route("/", listStrikesRoute)
    // Static path, so it has to beat "/:eventId" to the punch as well
    .route("/", getMyEventHistoryRoute)
    .route("/", createStrikeRoute)
    .route("/", deleteStrikeRoute)

    // Kalender-abonnement (statisk /calendar-sti, må slå "/:eventId")
    .route("/", getCalendarFeedRoute)

    // Favorites (registered before "/:eventId" so the static /favorite path wins)
    .route("/favorite", updateFavoriteEventsRoute)
    .route("/favorite", getFavoriteEventsRoute)

    // Event routes
    .route("/", createRoute)
    .route("/", listRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)
    .route("/", getRoute)

    // Registration
    // url prefix is delegated because we capture the :eventId there
    // i.e. /:eventId/registration
    .route("/", registerToEventRoute)
    .route("/", getAllRegistrationsForEventsRoute)
    .route("/", deleteEventRegistrationRoute)
    .route("/", setAttendanceRoute)

    // Payment
    .route("/", createPaymentRoute)
    .route("/", listEventPaymentsRoute)
    .route("/", refundEventPaymentRoute)
    .route("/", paymentWebhookRoute)

    // Forms
    .route("/", createEventFormRoute)
    .route("/", listEventFormsRoute)
    .route("/", getEventFormRoute);
