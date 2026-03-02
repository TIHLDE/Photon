import { type DbSchema, schema } from "@photon/db";
import { type InferInsertModel, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { requireAccess } from "~/middleware/access";
import { generateUniqueEventSlug } from "../../lib/event/slug";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import { createEventResponseSchema, createEventSchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["events"],
        summary: "Create event",
        operationId: "createEvent",
        description: "Create a new event. Requires 'events:create' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createEventResponseSchema,
            description: "Created",
        })
        .forbidden({ description: "Missing events:create permission" })
        .build(),
    requireAuth,
    requireAccess({ permission: "events:create" }),
    validator("json", createEventSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        let createdEventId: string | undefined;

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
                priceMinor: body.price ? body.price * 100 : null,
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
                enforcesPreviousStrikes: body.enforcesPreviousStrikes,
            };

            const [event] = await db
                .insert(schema.event)
                .values(newEvent)
                .returning({ eventId: schema.event.id });

            const eventId = event?.eventId;
            if (!eventId) {
                throw new HTTPException(500, {
                    message: "Failed to create event",
                });
            }

            createdEventId = eventId;

            if (body.priorityPools) {
                for (let p = 0; p < body.priorityPools.length; p++) {
                    const pool = body.priorityPools[p];
                    const priorityScore = 10 - p;
                    const [insertedPool] = await tx
                        .insert(schema.eventPriorityPool)
                        .values({
                            eventId,
                            priorityScore,
                        })
                        .returning({ poolId: schema.eventPriorityPool.id });
                    const poolId = insertedPool?.poolId;

                    if (!poolId) {
                        throw new HTTPException(500, {
                            message: "Failed to create priority pool",
                        });
                    }

                    for (const groupSlug of pool?.groups ?? []) {
                        await tx.insert(schema.eventPriorityPoolGroup).values({
                            groupSlug,
                            priorityPoolId: poolId,
                        });
                    }
                }
            }
        });

        if (!createdEventId) {
            throw new HTTPException(500, {
                message: "Failed to create event",
            });
        }

        return c.json({ eventId: createdEventId }, 201);
    },
);
