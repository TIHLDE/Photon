import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { favoriteEventsSchema } from "../schema";

export const getFavoriteEventsRoute = route().get(
    "/",
    describeRoute({
        tags: ["events"],
        summary: "Get all my favorite events",
        description:
            "Retrieve a list of all events you have marked as favorite.",
        operationId: "getFavoriteEvents",
    })
        .schemaResponse({
            statusCode: 200,
            schema: favoriteEventsSchema,
            description: "List of favorite events",
        })
        .build(),
    requireAuth,
    async (c) => {
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        // Get all favorite event IDs for the user
        const favorites = await db.query.eventFavorite.findMany({
            where: eq(schema.eventFavorite.userId, userId),
            with: {
                event: {
                    columns: {
                        id: true,
                        title: true,
                        slug: true,
                        start: true,
                        end: true,
                    },
                },
            },
        });

        // Sorted by when the event happens, not by when it was favorited: the
        // list is read as a calendar, and the client needs the times to tell a
        // favorite that is still coming up from one that is over.
        const returnFavorites: z.infer<typeof favoriteEventsSchema> = favorites
            .map((fav) => ({
                eventId: fav.eventId,
                slug: fav.event.slug,
                title: fav.event.title,
                startTime: fav.event.start.toISOString(),
                endTime: fav.event.end.toISOString(),
                createdAt: fav.createdAt.toISOString(),
            }))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        return c.json(returnFavorites, 200);
    },
);
