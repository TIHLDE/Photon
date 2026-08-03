import type z from "zod";
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
        const identifier = c.req.param("eventId");
        // The public frontend routes events by slug, while other clients use
        // the UUID. Accept either: match by id when the param is a UUID,
        // otherwise fall back to the slug.
        const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                identifier,
            );
        const event = await db.query.event.findFirst({
            where: (event, { eq }) =>
                isUuid ? eq(event.id, identifier) : eq(event.slug, identifier),
            with: {
                category: true,
                organizer: true,
                contactPerson: {
                    columns: { id: true, name: true, email: true },
                },
                reactions: {
                    columns: { userId: true, emoji: true },
                    with: { user: { columns: { name: true } } },
                },
                restrictedToInstitute: {
                    columns: { slug: true, shortName: true, name: true },
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
                                        logoUrl: true,
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

        const user = c.get("user");

        // Members-only events are hidden from unauthenticated (non-member)
        // callers. Any authenticated user counts as a member. Respond 404
        // rather than 403 so the event's existence isn't leaked.
        if (event.visibility === "members" && !user) {
            return c.json("The event was not found", 404);
        }

        let registration: z.infer<typeof eventDetailSchema>["registration"] =
            null;

        if (user) {
            const dbRegistration = await db.query.eventRegistration.findFirst({
                where: (registration, { eq, and }) =>
                    and(
                        eq(registration.userId, user.id),
                        eq(registration.eventId, event.id),
                    ),
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

        const organizer = event.organizer
            ? {
                  name: event.organizer.name,
                  slug: event.organizer.slug,
                  type: event.organizer.type,
                  // The organizer is rendered as a round avatar, so this is the
                  // logo — the gruppebilde belongs on the group's about tab.
                  image: event.organizer.logoUrl,
              }
            : null;

        // Navnet er offentlig, e-posten er det ikke: adressen deles bare med
        // innloggede medlemmer, så den ikke kan høstes fra de åpne sidene.
        const contactPerson = event.contactPerson
            ? {
                  id: event.contactPerson.id,
                  name: event.contactPerson.name,
                  email: user ? event.contactPerson.email : null,
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
                logoUrl: g.group.logoUrl,
            })),
        }));

        const returnEvent: z.infer<typeof eventDetailSchema> = {
            id: event.id,
            slug: event.slug,
            title: event.title,
            description: event.description ?? "",
            location: event.location,
            locationLat: event.locationLat,
            locationLng: event.locationLng,
            startTime: event.start.toISOString(),
            endTime: event.end.toISOString(),
            registrationStart: event.registrationStart?.toISOString() ?? null,
            registrationEnd: event.registrationEnd?.toISOString() ?? null,
            cancellationDeadline:
                event.cancellationDeadline?.toISOString() ?? null,
            organizer,
            contactPerson,
            category,
            closed: event.isRegistrationClosed,
            requiresSigningUp: event.requiresSigningUp,
            allowWaitlist: event.allowWaitlist,
            capacity: event.capacity,
            canCauseStrikes: event.canCauseStrikes,
            image: event.imageUrl,
            imageAlt: event.imageAlt,
            createdById: event.createdByUserId,
            createdAt: event.createdAt.toISOString(),
            updatedAt: event.updatedAt.toISOString(),
            reactions,
            isPaidEvent: event.isPaidEvent,
            payInfo,
            enforcesPreviousStrikes: event.enforcesPreviousStrikes,
            onlyAllowPrioritized: event.onlyAllowPrioritized,
            restrictedToInstitute: event.restrictedToInstitute ?? null,
            visibility: event.visibility,
            priorityPools,
            registration,
        };

        return c.json(returnEvent);
    },
);
