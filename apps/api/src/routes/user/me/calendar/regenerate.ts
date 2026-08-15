import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    calendarFeedUrl,
    regenerateCalendarToken,
} from "~/lib/user/calendar-token";
import { requireAuthAllowPending } from "~/middleware/auth";
import { calendarSubscriptionSchema } from "../../schema";

/** Lager en ny URL og gjør den forrige ubrukelig. */
export const regenerateCalendarSubscriptionRoute = route().post(
    "/regenerate",
    describeRoute({
        tags: ["users"],
        summary: "Regenerate my calendar subscription URL",
        operationId: "regenerateCalendarSubscription",
        description:
            "Issue a new personal iCalendar subscription URL. The previous URL stops working immediately.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: calendarSubscriptionSchema,
            description: "New calendar subscription URL",
        })
        .unauthorized()
        .build(),
    requireAuthAllowPending,
    async (c) => {
        const ctx = c.get("ctx");
        const userId = c.get("user").id;

        const token = await regenerateCalendarToken(userId, ctx);

        return c.json({ url: calendarFeedUrl(token) }, 200);
    },
);
