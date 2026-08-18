import { schema } from "@photon/db";
import { and, eq, inArray } from "drizzle-orm";
import type z from "zod";
import { hasPermission, hasScopedPermission } from "@photon/auth/rbac";
import { isMemberAudience } from "~/lib/auth";
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
        const ctx = c.get("ctx");
        const { db } = ctx;
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
                priorityUsers: {
                    columns: {},
                    with: {
                        user: {
                            columns: {
                                id: true,
                                name: true,
                                username: true,
                                image: true,
                            },
                        },
                    },
                },
                pools: {
                    columns: { id: true, classYear: true },
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
        });

        if (!event) {
            return c.json("The event was not found", 404);
        }

        const user = c.get("user");

        // Members-only events are hidden from callers who are not members —
        // which includes a signed-in account still waiting for an admin to
        // approve it. Respond 404 rather than 403 so the event's existence
        // isn't leaked.
        if (event.visibility === "members" && !isMemberAudience(user)) {
            return c.json("The event was not found", 404);
        }

        // How many are going is public; who they are is not. The roster
        // endpoint is members-only, so the counts live here instead — the
        // registered one covers the same set of statuses that endpoint counts
        // by default. The waitlist length belongs next to it: on a full event
        // it is what tells a member whether queueing up is worth it.
        const [registeredCount, waitlistCount] = await Promise.all([
            db.$count(
                schema.eventRegistration,
                and(
                    eq(schema.eventRegistration.eventId, event.id),
                    inArray(schema.eventRegistration.status, [
                        "registered",
                        "attended",
                        "no_show",
                    ]),
                ),
            ),
            db.$count(
                schema.eventRegistration,
                and(
                    eq(schema.eventRegistration.eventId, event.id),
                    eq(schema.eventRegistration.status, "waitlisted"),
                ),
            ),
        ]);

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
                // Om betalingen er gjennomført avgjør både om medlemmet får
                // tilbudet om å selge billetten sin videre, og om avmeldingen
                // er stengt — en betalt plass kan ikke gis fra seg. Bare
                // paid-events har rader i betalingstabellen, så
                // gratisarrangementer slipper spørringen.
                //
                // De ubetalte radene er med av samme grunn: en plass på et
                // betalt arrangement kommer med en frist, og uten den vet ikke
                // klienten om den skal be om betaling eller hvor lenge
                // plassen holdes av.
                const payments = event.isPaidEvent
                    ? await db.query.eventPayment.findMany({
                          columns: {
                              status: true,
                              expiresAt: true,
                          },
                          where: (payment, { eq, and }) =>
                              and(
                                  eq(payment.eventId, event.id),
                                  eq(payment.userId, user.id),
                              ),
                      })
                    : [];

                const hasPaid = payments.some(
                    (payment) => payment.status === "paid",
                );
                const pendingPayment = payments.find(
                    (payment) => payment.status === "pending",
                );

                registration = {
                    attendedAt:
                        dbRegistration.attendedAt?.toISOString() ?? null,
                    createdAt: dbRegistration.createdAt.toISOString(),
                    status: dbRegistration.status,
                    updatedAt: dbRegistration.updatedAt.toISOString(),
                    waitlistPosition: dbRegistration.waitlistPosition,
                    hasPaid,
                    paymentExpiresAt:
                        !hasPaid && pendingPayment?.expiresAt
                            ? pendingPayment.expiresAt.toISOString()
                            : null,
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

        /**
         * Hvem som er prioritert som gruppe er en regel; hvem som er
         * prioritert ved navn er en opplysning om enkeltpersoner. Lista deles
         * derfor bare med de som kan redigere arrangementet — de trenger den
         * for å redigere den. Alle andre får en tom liste, ikke et hull i
         * responsen, så klientene slipper å skille «ingen» fra «vet ikke».
         *
         * Samme regel som PUT-en krever (`requireEventAccess` + eierskap), så
         * den som får se lista er nøyaktig den som får skrive den.
         *
         * Rekkefølgen i betingelsen er ikke tilfeldig: dette er den mest
         * trafikkerte ruten på nettsiden, og de aller fleste arrangementer har
         * ingen navngitte i det hele tatt. Da skal ingen rettighetssjekk
         * kjøre. Scopet leses fra raden vi allerede har lastet, framfor å be
         * `canActOnEvent` hente arrangørgruppa på nytt.
         */
        const maySeePriorityUsers =
            event.priorityUsers.length > 0 &&
            user != null &&
            (event.createdByUserId === user.id ||
                (event.organizerGroupSlug
                    ? await hasScopedPermission(
                          ctx,
                          user.id,
                          ["events:update", "events:manage"],
                          `group:${event.organizerGroupSlug}`,
                      )
                    : await hasPermission(ctx, user.id, [
                          "events:update",
                          "events:manage",
                      ])));

        const priorityUsers = maySeePriorityUsers
            ? event.priorityUsers.map((entry) => ({
                  id: entry.user.id,
                  name: entry.user.name,
                  username: entry.user.username,
                  image: entry.user.image,
              }))
            : [];

        const priorityPools = event.pools.map((pool) => ({
            classYear: pool.classYear,
            group: pool.group
                ? {
                      name: pool.group.name,
                      slug: pool.group.slug,
                      logoUrl: pool.group.logoUrl,
                  }
                : null,
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
            registeredCount,
            waitlistCount,
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
            priorityUsers,
            registration,
        };

        return c.json(returnEvent);
    },
);
