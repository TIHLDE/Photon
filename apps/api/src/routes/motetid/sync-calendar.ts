import { env } from "@photon/core/env";
import { schema } from "@photon/db";
import { toDate } from "date-fns-tz";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import {
    EVENT_TIMEZONE,
    googleCalendarListQueryBounds,
    intervalsOverlap,
    slotRangeUtc,
} from "~/lib/motetid/event-timezone";
import { buildTimeSlots } from "~/lib/motetid/time";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    slugParamSchema,
    syncCalendarErrorSchema,
    syncCalendarResponseSchema,
} from "./schema";

type GoogleEvent = {
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
};

function parseGoogleEventRange(
    item: GoogleEvent,
    timeZone: string,
): { start: Date; end: Date } | null {
    if (item.start?.dateTime && item.end?.dateTime) {
        const start = new Date(item.start.dateTime);
        const end = new Date(item.end.dateTime);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return null;
        }
        return { start, end };
    }
    if (item.start?.date && item.end?.date) {
        const start = toDate(`${item.start.date}T00:00:00`, { timeZone });
        const end = toDate(`${item.end.date}T00:00:00`, { timeZone });
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return null;
        }
        return { start, end };
    }
    return null;
}

export const syncCalendarRoute = route().post(
    "/events/:slug/sync-calendar",
    describeRoute({
        tags: ["motetid"],
        summary: "Sync Google Calendar busy times",
        operationId: "motetidSyncCalendar",
        description:
            "Fetch the authenticated member's primary Google Calendar over the event's date range and return which grid slots overlap busy events. Refreshes the access token automatically when expired. Weekday-mode boards have no calendar dates, so they always return empty.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: syncCalendarResponseSchema,
            description: "Busy slots computed",
        })
        .schemaResponse({
            statusCode: 400,
            schema: syncCalendarErrorSchema,
            description:
                "Google credential missing or invalid — reconnect required",
        })
        .notFound({ description: "Event not found" })
        .build(),
    requireAuth,
    validator("param", slugParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { slug } = c.req.valid("param");

        const credential = await db.query.motetidGoogleCredential.findFirst({
            where: eq(schema.motetidGoogleCredential.userId, userId),
        });
        if (!credential) {
            return c.json(
                { error: "Fant ikke Google-token", requiresReconnect: true },
                400,
            );
        }

        const event = await db.query.motetidEvent.findFirst({
            where: eq(schema.motetidEvent.slug, slug),
        });
        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        // A weekday board has no calendar dates to look up: any busy overlay
        // would come from one arbitrary week and misrepresent a recurring slot.
        if (event.dateMode === "WEEKDAYS") {
            return c.json({ blocked: [], events: [] }, 200);
        }

        const timeZone = EVENT_TIMEZONE;
        const sortedDates = [...event.dates].sort();
        const firstBoardDate = sortedDates[0];
        const lastBoardDate = sortedDates[sortedDates.length - 1];
        if (!firstBoardDate || !lastBoardDate) {
            return c.json({ blocked: [], events: [] }, 200);
        }

        const { timeMin, timeMax } = googleCalendarListQueryBounds(
            firstBoardDate,
            lastBoardDate,
            timeZone,
        );
        const url = new URL(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        );
        url.searchParams.set("timeMin", timeMin.toISOString());
        url.searchParams.set("timeMax", timeMax.toISOString());
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");

        const fetchGoogleEvents = (accessToken: string) =>
            fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

        let response = await fetchGoogleEvents(credential.accessToken);

        if (
            !response.ok &&
            (response.status === 401 || response.status === 403)
        ) {
            if (!credential.refreshToken) {
                return c.json(
                    {
                        error: "Fant ikke Google-token",
                        requiresReconnect: true,
                    },
                    400,
                );
            }
            if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
                throw new HTTPException(501, {
                    message: "Google OAuth er ikke konfigurert",
                });
            }

            const refreshRes = await fetch(
                "https://oauth2.googleapis.com/token",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        client_id: env.GOOGLE_CLIENT_ID,
                        client_secret: env.GOOGLE_CLIENT_SECRET,
                        refresh_token: credential.refreshToken,
                        grant_type: "refresh_token",
                    }).toString(),
                },
            );

            const refreshData = refreshRes.ok
                ? ((await refreshRes.json()) as { access_token?: string })
                : null;
            if (!refreshData?.access_token) {
                return c.json(
                    {
                        error: "Kunne ikke oppdatere Google-token",
                        requiresReconnect: true,
                    },
                    400,
                );
            }

            await db
                .update(schema.motetidGoogleCredential)
                .set({ accessToken: refreshData.access_token })
                .where(eq(schema.motetidGoogleCredential.userId, userId));

            response = await fetchGoogleEvents(refreshData.access_token);
        }

        if (!response.ok) {
            let googleMessage = "";
            try {
                const googleErr = (await response.json()) as {
                    error?: { message?: string; status?: string };
                };
                googleMessage =
                    googleErr.error?.message?.trim() ||
                    googleErr.error?.status?.trim() ||
                    "";
            } catch {
                googleMessage = "";
            }

            if (response.status === 401 || response.status === 403) {
                return c.json(
                    {
                        error:
                            googleMessage ||
                            "Google-tilgang er ugyldig eller mangler rettigheter. Koble kalenderen til på nytt.",
                        requiresReconnect: true,
                    },
                    400,
                );
            }

            throw new HTTPException(502, {
                message: googleMessage
                    ? `Kunne ikke hente Google-hendelser: ${googleMessage}`
                    : "Kunne ikke hente Google-hendelser",
            });
        }

        const data = (await response.json()) as { items?: GoogleEvent[] };
        const items = data.items ?? [];

        const slots = buildTimeSlots(
            event.startTime,
            event.endTime,
            event.slotDuration,
        );
        const blocked = new Set<string>();
        const overlayEvents: { title: string; start: string; end: string }[] =
            [];

        for (const item of items) {
            const range = parseGoogleEventRange(item, timeZone);
            if (!range) continue;

            const title =
                (item.summary ?? "(Uten tittel)").trim() || "(Uten tittel)";
            overlayEvents.push({
                title,
                start: range.start.toISOString(),
                end: range.end.toISOString(),
            });

            for (const date of event.dates) {
                for (const time of slots) {
                    const { start: slotStart, end: slotEnd } = slotRangeUtc(
                        date,
                        time,
                        event.slotDuration,
                        timeZone,
                    );
                    if (
                        intervalsOverlap(
                            slotStart,
                            slotEnd,
                            range.start,
                            range.end,
                        )
                    ) {
                        blocked.add(`${date}|${time}`);
                    }
                }
            }
        }

        return c.json(
            { blocked: Array.from(blocked), events: overlayEvents },
            200,
        );
    },
);
