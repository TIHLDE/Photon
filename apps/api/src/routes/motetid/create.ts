import crypto from "node:crypto";
import { schema } from "@photon/db";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import { normalizeDates } from "~/lib/motetid/time";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    createMotetidEventResponseSchema,
    createMotetidEventSchema,
} from "./schema";

const SLUG_ATTEMPTS = 5;

function randomSlug(): string {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

export const createRoute = route().post(
    "/events",
    describeRoute({
        tags: ["motetid"],
        summary: "Create a scheduling event",
        operationId: "createMotetidEvent",
        description:
            "Create a when2meet-style scheduling event with a daily time window and either candidate dates (a one-off activity) or candidate weekdays (a recurring weekly slot). Returns the share-link slug.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createMotetidEventResponseSchema,
            description: "Event created",
        })
        .build(),
    requireAuth,
    validator("json", createMotetidEventSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const body = c.req.valid("json");
        const dateMode = body.dateMode ?? "DATES";

        // Retry on the (unlikely) slug collision instead of surfacing a 500.
        for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
            const slug = randomSlug();
            try {
                const [created] = await db
                    .insert(schema.motetidEvent)
                    .values({
                        slug,
                        title: body.title,
                        createdById: userId,
                        dateMode,
                        dates: normalizeDates(body.dates, dateMode),
                        startTime: body.startTime,
                        endTime: body.endTime,
                        deadline: body.deadline
                            ? new Date(body.deadline)
                            : null,
                    })
                    .returning({
                        id: schema.motetidEvent.id,
                        slug: schema.motetidEvent.slug,
                    });

                if (created) return c.json(created, 201);
            } catch (error) {
                const isUniqueViolation =
                    typeof error === "object" &&
                    error !== null &&
                    "code" in error &&
                    (error as { code?: string }).code === "23505";
                if (!isUniqueViolation) throw error;
            }
        }

        throw new HTTPException(500, { message: "Failed to create event" });
    },
);
