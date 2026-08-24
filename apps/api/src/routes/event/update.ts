import { type DbSchema, schema } from "@photon/db";
import { type InferInsertModel, and, eq } from "drizzle-orm";
import { validatePriorityPools } from "~/lib/event/validate-priority-pools";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { promoteAssetUrls } from "~/lib/asset";
import { describeRoute } from "~/lib/openapi";
import { canActOnEventsForGroup, requireEventAccess } from "~/lib/event/access";
import {
    calculateWaitlistPositions,
    resolvePriorityUserIds,
} from "~/lib/event/priority";
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
            "Update an event by its ID. Event creators can update their own events. Users with 'events:update' or 'events:manage' — globally or for the arranging group — can update the events they hold it for.",
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
    requireEventAccess({
        permission: ["events:update", "events:manage"],
        param: "id",
        ownership: isEventOwner,
    }),
    validator("json", updateEventSchema),
    async (c) => {
        const body = c.req.valid("json");
        const eventId = c.req.param("id");
        const userId = c.get("user").id;
        const { db, bucket } = c.get("ctx");

        // Uploaded pictures are staged until a row claims them; without this
        // the cleanup cron deletes the file after two days.
        await promoteAssetUrls(bucket, [body.imageUrl]);

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

                // Handing the event to another group is arranging an event
                // for that group, so it takes the permission there too —
                // otherwise a group-scoped grant could push events onto
                // groups it has no say over.
                if (
                    !(await canActOnEventsForGroup(
                        // Must read through `tx`: the pool connection is held
                        // by this transaction, so querying past it would
                        // deadlock.
                        { ...c.get("ctx"), db: tx },
                        userId,
                        body.organizerGroupSlug,
                        ["events:update", "events:manage"],
                    ))
                ) {
                    throw new HTTPException(403, {
                        message: `Forbidden - requires events:update or events:manage for group "${body.organizerGroupSlug}"`,
                    });
                }
            }
            // Validated against the organizer the event will have after this
            // update, not the one it had before: moving an event to another
            // group can invalidate a pool that was legal a moment ago.
            await validatePriorityPools(
                tx,
                body.priorityPools,
                body.organizerGroupSlug ?? event.organizerGroupSlug,
            );

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

                if (body.priorityPools.length) {
                    await tx.insert(schema.eventPriorityPool).values(
                        body.priorityPools.map((pool) => ({
                            eventId,
                            groupSlug: pool.groupSlug,
                            classYear: pool.classYear,
                        })),
                    );
                }
            }

            // Som poolene over: feltet erstattes i sin helhet når det er med,
            // og røres ikke når det mangler — en PATCH som ikke nevner
            // prioriterte personer skal ikke fjerne dem.
            if (body.priorityUserIds) {
                await tx
                    .delete(schema.eventPriorityUser)
                    .where(eq(schema.eventPriorityUser.eventId, eventId));

                const priorityUserIds = await resolvePriorityUserIds(
                    body.priorityUserIds,
                    tx,
                );
                if (priorityUserIds.length > 0) {
                    await tx.insert(schema.eventPriorityUser).values(
                        priorityUserIds.map((priorityUserId) => ({
                            eventId,
                            userId: priorityUserId,
                        })),
                    );
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

            const nextRegistrationStart = updateDateNullable(
                body.registrationStart,
            );

            // Moving the opening means the already-sent "åpner snart" reminder
            // was about the old time, so clear the marker and let the reminder
            // cron send a fresh one for the new opening. `undefined` leaves the
            // opening — and therefore the marker — untouched.
            const registrationStartChanged =
                nextRegistrationStart !== undefined &&
                (nextRegistrationStart?.getTime() ?? null) !==
                    (event.registrationStart?.getTime() ?? null);

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
                openToAlumni: body.openToAlumni,
                restrictedToInstituteId,
                visibility: body.visibility,
                isPaidEvent: body.isPaidEvent,
                isRegistrationClosed: body.isRegistrationClosed,
                reactionsAllowed: body.reactionsAllowed,
                requiresSigningUp: body.requiresSigningUp,
                enforcesPreviousStrikes: body.enforcesPreviousStrikes,
                canCauseStrikes: body.canCauseStrikes,
                priceMinor: body.price ? body.price * 100 : null,
                updatedAt: new Date(),
                title: body.title,
                start: updateDate(body.start),
                end: updateDate(body.end),
                registrationStart: nextRegistrationStart,
                registrationReminderSentAt: registrationStartChanged
                    ? null
                    : undefined,
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

            /**
             * Ventelista står i den rekkefølgen prioriteringen ga den, og
             * `waitlistPosition` er det lagrede svaret — både medlemmet og
             * `promoteFromWaitlist` leser den kolonnen, ikke reglene.
             *
             * Uten denne omregningen ville en nettopp lagt til prioritert
             * blitt stående der hen sto til noen andre meldte seg på og
             * resolveren regnet om lista som en bieffekt. Det er nettopp det
             * tilfellet feltet er laget for: arrangementet er fullt, noen får
             * plass lovet, og de legges til etterpå.
             *
             * Kjøres når prioriteringen faktisk er rørt — endres bare
             * tittelen, er rekkefølgen den samme. Prikkehåndhevingen teller
             * med, siden den avgjør hvem prioriteringen gjelder for.
             */
            const priorityChanged =
                body.priorityPools !== undefined ||
                body.priorityUserIds !== undefined ||
                body.enforcesPreviousStrikes !== undefined;

            if (priorityChanged) {
                const refreshed = await tx.query.event.findFirst({
                    where: (e, { eq }) => eq(e.id, eventId),
                    columns: { enforcesPreviousStrikes: true },
                    with: {
                        pools: true,
                        priorityUsers: true,
                    },
                });

                if (refreshed) {
                    const positions = await calculateWaitlistPositions(
                        eventId,
                        refreshed,
                        refreshed.enforcesPreviousStrikes,
                        tx,
                    );

                    for (const [waitlistedUserId, position] of positions) {
                        await tx
                            .update(schema.eventRegistration)
                            .set({ waitlistPosition: position })
                            .where(
                                and(
                                    eq(
                                        schema.eventRegistration.eventId,
                                        eventId,
                                    ),
                                    eq(
                                        schema.eventRegistration.userId,
                                        waitlistedUserId,
                                    ),
                                ),
                            );
                    }
                }
            }

            return slug;
        });

        return c.json({ eventId, slug: updatedSlug }, 200);
    },
);
