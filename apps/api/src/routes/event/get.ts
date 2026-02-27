import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../lib/route";
import { captureAuth } from "../../middleware/auth";
import { eventDetailSchema } from "./schema";

export const getRoute = route().get(
    "/:eventId",
    describeRoute({
        tags: ["events"],
        summary: "Get event by ID",
        operationId: "getEvent",
        description:
            "Retrieve detailed information about a specific event, including registration status for the authenticated user if available",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventDetailSchema,
            description: "The event was found",
        })
        .build(),
    captureAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const event = await db.query.event.findFirst({
            where: (event, { eq }) => eq(event.id, c.req.param("eventId")),
            with: {
                category: true,
                organizer: true,
                reactions: {
                    columns: { userId: true, emoji: true },
                    with: { user: { columns: { name: true } } },
                },
                pools: {
                    columns: { priorityScore: true, id: true },
                    with: {
                        groups: {
                            with: {
                                group: {
                                    columns: {
                                        name: true,
                                        slug: true,
                                        imageUrl: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const user = c.get("user");

        let registration: z.infer<typeof eventDetailSchema>["registration"] = null;

        if (user) {
            const dbRegistration = await db.query.eventRegistration.findFirst({
                where: (registration, { eq }) =>
                    eq(registration.userId, user.id),
            });

            if (dbRegistration) {
                registration = {
                    attendedAt:
                        dbRegistration.attendedAt?.toISOString() ?? null,
                    createdAt: dbRegistration.createdAt.toISOString(),
                    status: dbRegistration.status,
                    updatedAt: dbRegistration.updatedAt.toISOString(),
                    waitlistPosition: dbRegistration.waitlistPosition,
                };
            }
        }

        if (!event) {
            return c.json("The event was not found", 404);
        }

        const organizer = event.organizer
            ? {
                  name: event.organizer.name,
                  slug: event.organizer.slug,
                  type: event.organizer.type,
                  image: event.organizer.imageUrl,
              }
            : null;

        const category = {
            slug: event.category.slug,
            label: event.category.label,
        };

        const reactions = event.reactions.map((r) => ({
            emoji: r.emoji,
            user: {
                id: r.userId,
                name: r.user.name,
            },
        }));

        const payInfo = event.isPaidEvent
            ? {
                  paymentGracePeriodMinutes:
                      event.paymentGracePeriodMinutes || 0,
                  price: event.priceMinor || 0,
              }
            : null;

        const priorityPools = event.pools.map((pool) => ({
            groups: pool.groups.map((g) => ({
                name: g.group.name,
                slug: g.group.slug,
                imageUrl: g.group.imageUrl,
            })),
        }));

        const returnEvent: z.infer<typeof eventDetailSchema> = {
            id: event.id,
            slug: event.slug,
            title: event.title,
            location: event.location,
            startTime: event.start.toISOString(),
            endTime: event.end.toISOString(),
            organizer,
            category,
            closed: event.isRegistrationClosed,
            image: event.imageUrl,
            createdAt: event.createdAt.toISOString(),
            updatedAt: event.updatedAt.toISOString(),
            reactions,
            isPaidEvent: event.isPaidEvent,
            payInfo,
            enforcesPreviousStrikes: event.enforcesPreviousStrikes,
            priorityPools,
            registration,
        };

        return c.json(returnEvent);
    },
);
