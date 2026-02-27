import z from "zod";
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
            with: {
                event: {
                    columns: { id: true, title: true, slug: true },
                },
            },
        });

        const returnFavorites: z.infer<typeof favoriteEventsSchema> =
            favorites.map((fav) => ({
                eventId: fav.eventId,
                slug: fav.event.slug,
                title: fav.event.title,
                createdAt: fav.createdAt.toISOString(),
            }));

        return c.json(returnFavorites, 200);
    },
);
