import { type DbSchema, schema } from "@photon/db";
import { validatePriorityPools } from "~/lib/event/validate-priority-pools";
import { type InferInsertModel, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { promoteAssetUrls } from "~/lib/asset";
import { canActOnEventsForGroup } from "~/lib/event/access";
import { resolvePriorityUserIds } from "~/lib/event/priority";
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
        description:
            "Create a new event. Requires 'events:create' either globally or for the group arranging it.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createEventResponseSchema,
            description: "Created",
        })
        .forbidden({
            description:
                "Missing events:create for the organizing group (or globally)",
        })
        .build(),
    requireAuth,
    // Coarse gate only: the scope lives in the body, which is not parsed yet,
    // so the group-level check happens in the handler below.
    requireAccess({ permission: "events:create", anyGroupScope: true }),
    validator("json", createEventSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { db, bucket } = c.get("ctx");

        // Uploaded pictures are staged until a row claims them; without this
        // the cleanup cron deletes the file after two days.
        await promoteAssetUrls(bucket, [body.imageUrl]);

        let createdEventId: string | undefined;

        await db.transaction(async (tx) => {
            const slug = await generateUniqueEventSlug(
                body.title,
                new Date(body.start),
                tx,
            );
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

            // The real permission check: events:create for THIS group. Runs
            // after the group lookup so an unknown slug still answers 400
            // rather than a misleading 403.
            if (
                !(await canActOnEventsForGroup(
                    // Must read through `tx`: the pool connection is held by
                    // this transaction, so querying past it would deadlock.
                    { ...c.get("ctx"), db: tx },
                    userId,
                    body.organizerGroupSlug,
                    "events:create",
                ))
            ) {
                throw new HTTPException(403, {
                    message: `Forbidden - requires events:create for group "${body.organizerGroupSlug}"`,
                });
            }

            // Needs the organizer, so it runs after the lookup above: an
            // interest group may only be prioritized on its own events.
            await validatePriorityPools(
                tx,
                body.priorityPools,
                body.organizerGroupSlug,
            );

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

            // Resolve the institute the event is reserved for, if any
            let restrictedToInstituteId: number | null = null;
            if (body.restrictedToInstituteSlug) {
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

            const newEvent: InferInsertModel<DbSchema["event"]> = {
                title: body.title,
                description: body.description,
                location: body.location,
                locationLat: body.locationLat ?? null,
                locationLng: body.locationLng ?? null,
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
                imageUrl: body.imageUrl,
                imageAlt: body.imageAlt,
                createdByUserId: userId,
                updateByUserId: userId,
                organizerGroupSlug: body.organizerGroupSlug,
                enforcesPreviousStrikes: body.enforcesPreviousStrikes,
                canCauseStrikes: body.canCauseStrikes,
                onlyAllowPrioritized: body.onlyAllowPrioritized,
                openToAlumni: body.openToAlumni ?? false,
                restrictedToInstituteId,
                visibility: body.visibility,
            };

            const [event] = await tx
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

            if (body.priorityPools?.length) {
                await tx.insert(schema.eventPriorityPool).values(
                    body.priorityPools.map((pool) => ({
                        eventId,
                        groupSlug: pool.groupSlug,
                        classYear: pool.classYear,
                    })),
                );
            }

            // Navngitte enkeltpersoner. Duplikater og ukjente id-er tas av
            // `resolvePriorityUserIds`, som kontaktpersonen over.
            const priorityUserIds = await resolvePriorityUserIds(
                body.priorityUserIds ?? [],
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
        });

        if (!createdEventId) {
            throw new HTTPException(500, {
                message: "Failed to create event",
            });
        }

        return c.json({ eventId: createdEventId }, 201);
    },
);
