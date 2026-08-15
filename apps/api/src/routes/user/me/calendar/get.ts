import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    calendarFeedUrl,
    getOrCreateCalendarToken,
} from "~/lib/user/calendar-token";
import { requireAuthAllowPending } from "~/middleware/auth";
import { calendarSubscriptionSchema } from "../../schema";

/**
 * URL-en brukeren limer inn i kalenderen sin. Nøkkelen lages første gang
 * ruta kalles, så brukere som aldri åpner siden får aldri noen nøkkel.
 */
export const getCalendarSubscriptionRoute = route().get(
    "/",
    describeRoute({
        tags: ["users"],
        summary: "Get my calendar subscription URL",
        operationId: "getCalendarSubscription",
        description:
            "Retrieve the personal iCalendar subscription URL for the authenticated user's event registrations. The URL is created on first request.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: calendarSubscriptionSchema,
            description: "Calendar subscription URL",
        })
        .unauthorized()
        .build(),
    requireAuthAllowPending,
    async (c) => {
        const ctx = c.get("ctx");
        const userId = c.get("user").id;

        const token = await getOrCreateCalendarToken(userId, ctx);

        return c.json({ url: calendarFeedUrl(token) }, 200);
    },
);
