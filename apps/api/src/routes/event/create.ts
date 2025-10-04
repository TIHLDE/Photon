import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db, { type DbSchema, schema } from "~/db";
import { generateUniqueEventSlug } from "../../lib/event/slug";
import { HTTPException } from "hono/http-exception";
import { eq, type InferInsertModel } from "drizzle-orm";
import { requirePermission } from "../../middleware/permission";
import { createEventSchema } from "../../lib/event/schema";
import { requireAuth } from "~/middleware/auth";

const eventSchema = z.object({
    id: z.uuid({ version: "v4" }),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    capacity: z.number(),
    allowWaitlist: z.boolean(),
    createdByUserId: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

const createBodySchemaOpenAPI =
    await resolver(createEventSchema).toOpenAPISchema();

export const createRoute = new Hono().post(
    "/",
    describeRoute({
        tags: ["events"],
        summary: "Create event",
        description: "Create a new event. Requires 'events:create' permission.",
        requestBody: {
            content: {
                "application/json": { schema: createBodySchemaOpenAPI.schema },
            },
        },
        responses: {
            201: {
                description: "Created",
                content: {
                    "application/json": { schema: resolver(eventSchema) },
                },
            },
            403: {
                description: "Forbidden - Missing events:create permission",
            },
        },
    }),
    requireAuth,
    requirePermission("events:create"),
    validator("json", createEventSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;

        await db.transaction(async (tx) => {
            const slug = await generateUniqueEventSlug(body.title, tx);
            if (slug.length > 256) {
                throw new HTTPException(400, {
                    message:
                        "Generated slug is too long (> 256 chars). Please use a shorter title",
                });
            }

            // Check that category exists
            const category = await tx
                .select()
                .from(schema.eventCategory)
                .where(eq(schema.eventCategory.slug, body.categorySlug))
                .limit(1);
            if (category.length === 0) {
                throw new HTTPException(400, {
                    message: `Category with slug "${body.categorySlug}" does not exist`,
                });
            }

            // Check that organizer group exists
            const group = await tx
                .select()
                .from(schema.group)
                .where(eq(schema.group.slug, body.organizerGroupSlug))
                .limit(1);
            if (group.length === 0) {
                throw new HTTPException(400, {
                    message: `Group with slug "${body.organizerGroupSlug}" does not exist`,
                });
            }

            // Check that contact person exists
            if (body.contactPersonUserId) {
                const contactPerson = await tx
                    .select()
                    .from(schema.user)
                    .where(eq(schema.user.id, body.contactPersonUserId))
                    .limit(1);
                if (contactPerson.length === 0) {
                    throw new HTTPException(400, {
                        message: `User with ID "${body.contactPersonUserId}" does not exist`,
                    });
                }
            }

            const newEvent: InferInsertModel<DbSchema["event"]> = {
                title: body.title,
                description: body.description,
                location: body.location,
                start: new Date(body.start),
                end: new Date(body.end),
                capacity: body.capacity,
                allowWaitlist: body.requiresSigningUp,
                slug,
                price: body.price,
                isPaidEvent: body.isPaidEvent,
                requiresSigningUp: body.requiresSigningUp,
                registrationStart: body.registrationStart
                    ? new Date(body.registrationStart)
                    : undefined,
                registrationEnd: body.registrationEnd
                    ? new Date(body.registrationEnd)
                    : undefined,
                cancellationDeadline: body.cancellationDeadline
                    ? new Date(body.cancellationDeadline)
                    : undefined,
                isRegistrationClosed: body.isRegistrationClosed,
                contactPersonId: body.contactPersonUserId,
                reactionsAllowed: body.reactionsAllowed,
                categorySlug: body.categorySlug,
                paymentGracePeriodMinutes: body.paymentGracePeriodMinutes,
                imageUrl: body.imageUrl,
                createdByUserId: userId,
                updateByUserId: userId,
                organizerGroupSlug: body.organizerGroupSlug,
            };

            await db.insert(schema.event).values(newEvent);
        });

        return c.json({ message: "Event created" }, 201);
    },
);
