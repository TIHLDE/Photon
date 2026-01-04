import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const getFavoriteSchema = z.array(
    z.object({
        eventId: z.string().meta({ description: "Event ID" }),
        title: z.string().meta({ description: "Event title" }),
        slug: z.string().meta({ description: "Event slug" }),
        createdAt: z.iso.datetime().meta({
            description: "When you added this event to your favorites",
        }),
    }),
);

export const getFavoriteEventsRoute = route().get(
    "/",
    describeRoute({
        tags: ["events"],
        summary: "Get all my favorite events",
        description:
            "Retrieve a list of all events you have marked as favorite.",
        operationId: "getFavoriteEvents",
    })
        .schemaResponse(200, getFavoriteSchema, "List of favorite events")
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

        const returnFavorites: z.infer<typeof getFavoriteSchema> =
            favorites.map((fav) => ({
                eventId: fav.eventId,
                slug: fav.event.slug,
                title: fav.event.title,
                createdAt: fav.createdAt.toISOString(),
            }));

        return c.json(returnFavorites, 200);
    },
);
