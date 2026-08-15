import { env } from "@photon/core/env";
import { schema } from "@photon/db";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { type ICalEvent, buildICalendar } from "~/lib/event/ical";

/**
 * Hvor langt tilbake i tid strømmen tar med arrangementer. Kalendere trenger
 * litt historikk for at uka man står i skal se riktig ut, men ikke fire år.
 */
const HISTORY_DAYS = 180;

/**
 * Kalenderstrøm for én bruker, identifisert av den hemmelige nøkkelen i
 * URL-en. Ruta er med vilje uten innlogging: Google Calendar, Apple Kalender
 * og Outlook henter URL-en uten cookies eller Authorization-header.
 */
export const getCalendarFeedRoute = route().get(
    "/calendar/:token/events.ics",
    describeRoute({
        tags: ["events"],
        summary: "Get a user's event calendar as iCalendar",
        operationId: "getCalendarFeed",
        description:
            "Returns the events the token's owner is registered for as an iCalendar (.ics) feed. Authenticated by the secret token in the path, so calendar clients can subscribe to it directly.",
    })
        .response({
            statusCode: 200,
            description: "iCalendar feed",
            options: {
                content: {
                    "text/calendar": { schema: { type: "string" } },
                },
            },
        })
        .notFound({ description: "Unknown calendar token" })
        .build(),
    async (c) => {
        const { db } = c.get("ctx");
        const token = c.req.param("token");

        const owner = await db.query.userCalendarToken.findFirst({
            where: eq(schema.userCalendarToken.token, token),
            columns: { userId: true },
        });

        if (!owner) {
            throw new HTTPException(404, {
                message: "Fant ingen kalender for denne lenken",
            });
        }

        const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

        const rows = await db
            .select({
                eventId: schema.event.id,
                title: schema.event.title,
                slug: schema.event.slug,
                description: schema.event.description,
                location: schema.event.location,
                start: schema.event.start,
                end: schema.event.end,
                updatedAt: schema.event.updatedAt,
                status: schema.eventRegistration.status,
            })
            .from(schema.eventRegistration)
            .innerJoin(
                schema.event,
                eq(schema.eventRegistration.eventId, schema.event.id),
            )
            .where(
                and(
                    eq(schema.eventRegistration.userId, owner.userId),
                    // Avmeldte plasser hører ikke hjemme i kalenderen.
                    inArray(schema.eventRegistration.status, [
                        "registered",
                        "waitlisted",
                        "pending",
                        "attended",
                        "no_show",
                    ]),
                    gte(schema.event.end, since),
                ),
            )
            .orderBy(asc(schema.event.start));

        const events: ICalEvent[] = rows.map((row) => ({
            // Stabil på tvers av henting, slik at klienten oppdaterer
            // arrangementet i stedet for å lage en duplikat.
            uid: `${row.eventId}@tihlde.org`,
            start: row.start,
            end: row.end,
            updatedAt: row.updatedAt,
            summary:
                row.status === "waitlisted"
                    ? `[Venteliste] ${row.title}`
                    : row.title,
            description: row.description,
            location: row.location,
            url: `${env.WEBSITE_URL}/arrangementer/${row.slug}`,
            // Ventelisteplasser er ikke bekreftet ennå, og markeres slik at
            // kalenderen kan vise dem som «kanskje».
            status:
                row.status === "waitlisted" || row.status === "pending"
                    ? "TENTATIVE"
                    : "CONFIRMED",
        }));

        const body = buildICalendar({
            name: "TIHLDE-arrangementer",
            productId: "tihlde.org",
            events,
        });

        return c.body(body, 200, {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="events.ics"',
            "Cache-Control": "private, max-age=300",
        });
    },
);
