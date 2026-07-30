import { type DbSchema, schema } from "@photon/db";
import { type InferInsertModel, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { requireAccess } from "~/middleware/access";
import { isEventOwner } from "../../lib/event/middleware";
import { generateUniqueEventSlug } from "../../lib/event/slug";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import { updateEventResponseSchema, updateEventSchema } from "./schema";

export const updateRoute = route().put(
    "/:id",
    describeRoute({
        tags: ["events"],
        summary: "Update event",
        operationId: "updateEvent",
        description:
            "Update an event by its ID. Event creators can update their own events. Users with 'events:update' or 'events:manage' permission can update any event.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateEventResponseSchema,
            description: "Updated",
        })
        .forbidden({
            description:
                "You must be the event creator or have events:update/events:manage permission",
        })
        .notFound({ description: "Not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["events:update", "events:manage"],
        ownership: { param: "id", check: isEventOwner },
    }),
    validator("json", updateEventSchema),
    async (c) => {
        const body = c.req.valid("json");
        const eventId = c.req.param("id");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        const updatedSlug = await db.transaction(async (tx) => {
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

            // Institute restriction is tri-state: an absent field leaves it
            // as is, null lifts the restriction, a slug sets it.
            let restrictedToInstituteId: number | null | undefined;
            if (body.restrictedToInstituteSlug === null) {
                restrictedToInstituteId = null;
            } else if (body.restrictedToInstituteSlug) {
                const institute = await tx
                    .select({ id: schema.institute.id })
                    .from(schema.institute)
                    .where(
                        eq(
                            schema.institute.slug,
                            body.restrictedToInstituteSlug,
                        ),
                    )
                    .limit(1);
                if (!institute[0]) {
                    throw new HTTPException(400, {
                        message: `Institute with slug "${body.restrictedToInstituteSlug}" does not exist`,
                    });
                }
                restrictedToInstituteId = institute[0].id;
            }

            // If title is updated, generate new slug. A date change alone keeps
            // the existing slug — rewriting it would break links already shared.
            let slug = event.slug;
            if (body.title && body.title !== event.title) {
                slug = await generateUniqueEventSlug(
                    body.title,
                    body.start ? new Date(body.start) : event.start,
                    tx,
                );
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
                // undefined lar Drizzle stå over feltet; eksplisitt null
                // nullstiller koordinatene når stedet endres til fritekst.
                locationLat: body.locationLat,
                locationLng: body.locationLng,
                organizerGroupSlug: body.organizerGroupSlug,
                slug: slug,
                capacity: body.capacity,
                imageUrl: body.imageUrl,
                imageAlt: body.imageAlt,
                onlyAllowPrioritized: body.onlyAllowPrioritized,
                restrictedToInstituteId,
                visibility: body.visibility,
                isPaidEvent: body.isPaidEvent,
                isRegistrationClosed: body.isRegistrationClosed,
                paymentGracePeriodMinutes: body.paymentGracePeriodMinutes,
                reactionsAllowed: body.reactionsAllowed,
                requiresSigningUp: body.requiresSigningUp,
                enforcesPreviousStrikes: body.enforcesPreviousStrikes,
                canCauseStrikes: body.canCauseStrikes,
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

            return slug;
        });

        return c.json({ eventId, slug: updatedSlug }, 200);
    },
);
