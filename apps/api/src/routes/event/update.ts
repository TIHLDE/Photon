import { type InferInsertModel, eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { type DbSchema, schema } from "~/db";
import { updateEventSchema } from "../../lib/event/schema";
import { generateUniqueEventSlug } from "../../lib/event/slug";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import { requireOwnershipOrAnyPermission } from "../../middleware/ownership";
import { isEventOwner } from "../../lib/event/middleware";

const updateBodySchemaOpenAPI =
    await resolver(updateEventSchema).toOpenAPISchema();

export const updateRoute = route().put(
    "/:id",
    describeRoute({
        tags: ["events"],
        summary: "Update event",
        description:
            "Update an event by its ID. Event creators can update their own events. Users with 'events:update' or 'events:manage' permission can update any event.",
        requestBody: {
            content: {
                "application/json": { schema: updateBodySchemaOpenAPI.schema },
            },
        },
        responses: {
            200: {
                description: "Updated",
            },
            403: {
                description:
                    "Forbidden - You must be the event creator or have events:update/events:manage permission",
            },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    requireOwnershipOrAnyPermission("id", isEventOwner, [
        "events:update",
        "events:manage",
    ]),
    validator("json", updateEventSchema),
    async (c) => {
        const body = c.req.valid("json");
        const eventId = c.req.param("id");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        await db.transaction(async (tx) => {
            // Fetch existing event
            const existing = await tx
                .select()
                .from(schema.event)
                .where(eq(schema.event.id, eventId))
                .limit(1);

            if (existing.length === 0 || !existing[0]) {
                throw new HTTPException(404, { message: "Event not found" });
            }
            const event = existing[0];

            // Validate referenced entities if updated
            if (body.categorySlug && body.categorySlug !== event.categorySlug) {
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
            }
            if (
                body.organizerGroupSlug &&
                body.organizerGroupSlug !== event.organizerGroupSlug
            ) {
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
            }
            if (
                body.contactPersonUserId &&
                body.contactPersonUserId !== event.contactPersonId
            ) {
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

            // If title is updated, generate new slug
            let slug = event.slug;
            if (body.title && body.title !== event.title) {
                slug = await generateUniqueEventSlug(body.title, tx);
                if (slug.length > 256) {
                    throw new HTTPException(400, {
                        message:
                            "Generated slug is too long (> 256 chars). Please use a shorter title",
                    });
                }
            }

            if (body.priorityPools) {
                // Start by removing all exising
                await tx
                    .delete(schema.eventPriorityPool)
                    .where(eq(schema.eventPriorityPool.eventId, eventId));

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

            const updateDateNullable = (
                date: string | null | undefined,
            ): Date | null | undefined => {
                if (date === null) return null;
                if (date) return new Date(date);
                return undefined;
            };

            const updateDate = (date: string | undefined): Date | undefined => {
                if (date) return new Date(date);
                return undefined;
            };

            const updatedEvent: Partial<InferInsertModel<DbSchema["event"]>> = {
                allowWaitlist: body.allowWaitlist,
                categorySlug: body.categorySlug,
                contactPersonId: body.contactPersonUserId,
                description: body.description,
                location: body.location,
                organizerGroupSlug: body.organizerGroupSlug,
                slug: slug,
                capacity: body.capacity,
                createdByUserId: userId,
                imageUrl: body.imageUrl,
                isPaidEvent: body.isPaidEvent,
                isRegistrationClosed: body.isRegistrationClosed,
                paymentGracePeriodMinutes: body.paymentGracePeriodMinutes,
                reactionsAllowed: body.reactionsAllowed,
                requiresSigningUp: body.requiresSigningUp,
                priceMinor: body.price ? body.price * 100 : null,
                updatedAt: new Date(),
                title: body.title,
                start: updateDate(body.start),
                end: updateDate(body.end),
                registrationStart: updateDateNullable(body.registrationStart),
                registrationEnd: updateDateNullable(body.registrationEnd),
                cancellationDeadline: updateDateNullable(
                    body.cancellationDeadline,
                ),
                updateByUserId: userId,
            };

            await tx
                .update(schema.event)
                .set(updatedEvent)
                .where(eq(schema.event.id, eventId));
        });

        return c.json("Event has been updated!", 200);
    },
);
