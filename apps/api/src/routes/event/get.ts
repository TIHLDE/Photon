import { Hono } from "hono";
import z, { emoji } from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "../../db";
import { withPagination } from "../../middleware/pagination";
import { isPgMaterializedView } from "drizzle-orm/pg-core";

const eventSchema = z.object({
    id: z.uuid({ version: "v4" }).meta({ description: "Event ID" }),
    slug: z.string().meta({ description: "Event slug" }),
    title: z.string().meta({ description: "Event title" }),
    location: z
        .string()
        .nullable()
        .optional()
        .meta({ description: "Event location (nullable)" }),
    startTime: z.iso
        .datetime()
        .meta({ description: "Event start time (ISO 8601)" }),
    endTime: z.iso
        .datetime()
        .meta({ description: "Event end time (ISO 8601)" }),
    organizer: z
        .object({
            name: z.string().meta({ description: "Organizer name" }),
            slug: z.string().meta({ description: "Organizer slug" }),
            type: z.string().meta({ description: "Organizer type" }),
            image: z
                .url()
                .nullable()
                .meta({ description: "Organizer image URL" }),
        })
        .nullable()
        .meta({ description: "Event organizer (nullable)" }),
    closed: z.boolean().meta({ description: "Is registration closed" }),
    image: z
        .url()
        .nullable()
        .meta({ description: "Event image URL (nullable)" }),
    createdAt: z.iso
        .datetime()
        .meta({ description: "Event creation time (ISO 8601)" }),
    updatedAt: z.iso
        .datetime()
        .meta({ description: "Event update time (ISO 8601)" }),
    category: z
        .object({
            slug: z.string().meta({ description: "Category slug" }),
            label: z.string().meta({ description: "Category label" }),
        })
        .meta({ description: "Event category" }),
    reactions: z.array(
        z.object({
            user: z.object({
                id: z.string().meta({ description: "User ID" }),
                name: z.string().meta({ description: "User name" }),
            }),
            emoji: z.string().meta({ description: "Reaction emoji" }),
        }),
    ),
    isPaidEvent: z.boolean().meta({ description: "Is this a paid event" }),
    payInfo: z
        .object({
            price: z.number().meta({ description: "Event price in whole KR" }),
            paymentGracePeriodMinutes: z
                .number()
                .meta({ description: "Payment grace period in minutes" }),
        })
        .nullable()
        .meta({ description: "Payment info" }),
    priorityPools: z
        .array(
            z.object({
                groups: z.array(
                    z.object({
                        name: z.string().meta({ description: "Group name" }),
                        slug: z.string().meta({ description: "Group slug" }),
                        imageUrl: z.string().nullable().meta({
                            description: "Group image URL (nullable)",
                        }),
                    }),
                ),
            }),
        )
        .meta({ description: "Priority registration pools" }),
    enforcesPreviousStrikes: z.boolean().meta({
        description: "Does the event enforce previous strikes for registration",
    }),
});

export const listRoute = new Hono().get(
    "/:eventId",
    describeRoute({
        tags: ["events"],
        summary: "Get event by ID",
        responses: {
            200: {
                description: "OK",
                content: {
                    "application/json": {
                        schema: resolver(z.array(eventSchema)),
                    },
                },
            },
        },
    }),
    async (c) => {
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
                  price: event.price || 0,
              }
            : null;

        const priorityPools = event.pools.map((pool) => ({
            groups: pool.groups.map((g) => ({
                name: g.group.name,
                slug: g.group.slug,
                imageUrl: g.group.imageUrl,
            })),
        }));

        const returnEvent: z.infer<typeof eventSchema> = {
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
        };

        return c.json(returnEvent);
    },
);
