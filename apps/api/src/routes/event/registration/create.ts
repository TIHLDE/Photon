import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import {
    getUserInstituteIds,
    isUserInInstitute,
} from "../../../lib/event/institute";
import {
    getUserGroupSlugs,
    isUserPrioritized,
} from "../../../lib/event/priority";
import { enqueueRegistrationResolve } from "../../../lib/event/resolve-queue";
import { getUserStrikeCount } from "../../../lib/event/strikes";
import { getUnansweredEvaluations } from "../../../lib/form/evaluation";
import { route } from "../../../lib/route";
import { hasAcceptedEventRules } from "../../../lib/user/settings";
import { requireAccess } from "../../../middleware/access";
import { requireAuth } from "../../../middleware/auth";
import {
    createRegistrationBodySchema,
    eventRegistrationResponseSchema,
} from "../schema";

export const registerToEventRoute = route().post(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Register to an event",
        operationId: "createEventRegistration",
        description:
            "Create a new registration for the authenticated user to attend an event, initially with pending status. Requires the 'events:registrations:create' permission — granted by the member baseline role (active students), not by the alumni role.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventRegistrationResponseSchema,
            description: "OK",
        })
        .notFound({ description: "Event not found" })
        .forbidden({
            description:
                "User has not accepted the event rules, owes an answer to an evaluation, or the event only allows members covered by a priority pool or members of a specific institute to register",
        })
        .response({
            statusCode: 409,
            description:
                "Event is not open for registration or user already registered",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "events:registrations:create" }),
    validator("json", createRegistrationBodySchema),
    async (c) => {
        const now = new Date();
        const eventId = c.req.param("eventId");
        const userId = c.get("user").id;
        const ctx = c.get("ctx");
        const { db } = ctx;
        const body = c.req.valid("json");

        /**
         * Hver av disse ser på noe helt forskjellig, og en påmelding som går
         * gjennom trenger svar fra alle sammen. Kjørt etter hverandre var
         * knappen fem tur-retur til databasen om å bli ferdig — her venter
         * den bare på den tregeste. Sjekkene under gjøres fortsatt i samme
         * rekkefølge, så medlemmet får samme feilmelding som før.
         */
        const [
            event,
            hasAcceptedRules,
            unanswered,
            existingRegistration,
            userSettings,
        ] = await Promise.all([
            db.query.event.findFirst({
                where: (event, { eq }) => eq(event.id, eventId),
                with: {
                    pools: {
                        with: {
                            groups: true,
                        },
                    },
                    restrictedToInstitute: true,
                },
            }),
            hasAcceptedEventRules(userId, ctx),
            getUnansweredEvaluations(ctx, userId),
            db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, eventId), eq(reg.userId, userId)),
            }),
            // Bare nødvendig når kallet ikke sier noe om bildesamtykke selv.
            body.allowPhoto === undefined
                ? db.query.userSettings.findFirst({
                      where: (settings, { eq }) => eq(settings.userId, userId),
                      columns: { allowsPhotosByDefault: true },
                  })
                : undefined,
        ]);

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        if (event.isRegistrationClosed || !event.requiresSigningUp) {
            throw new HTTPException(409, {
                message: "Event is not open for registration",
            });
        }

        // Checked before every event-specific rule so the message a member
        // gets is the one thing they can act on. The frontend shows the same
        // block ahead of time — hitting it here means they went around it.
        if (!hasAcceptedRules) {
            throw new HTTPException(403, {
                message:
                    "You must accept the event rules before registering for events",
            });
        }

        /**
         * An evaluation the member owes an answer to blocks every new
         * registration, exactly as it did in Lepton. It is the only thing that
         * makes an evaluation mandatory in practice — without it a bedpres
         * gets answers from whoever happens to feel like it.
         *
         * The events are named in the message: "you have unanswered
         * evaluations" is useless if you cannot tell which.
         */
        if (unanswered.length > 0) {
            const titles = unanswered.map((e) => e.eventTitle).join(", ");
            throw new HTTPException(403, {
                message: `Du må svare på evalueringen for ${titles} før du kan melde deg på flere arrangementer`,
            });
        }

        // Events tied to one institute reject everyone outside it, so a
        // DigSec (IIK) student cannot take an IDI seat, or the other way
        // around.
        if (event.restrictedToInstituteId !== null) {
            const userInstituteIds = await getUserInstituteIds(userId, db);

            if (
                !isUserInInstitute(
                    event.restrictedToInstituteId,
                    userInstituteIds,
                )
            ) {
                const shortName =
                    event.restrictedToInstitute?.shortName ?? "instituttet";
                throw new HTTPException(403, {
                    message: `This event is only open to students at ${shortName}`,
                });
            }
        }

        // Events with onlyAllowPrioritized reject non-prioritized users
        // outright at sign-up time, instead of waitlisting them.
        if (event.onlyAllowPrioritized) {
            const [userGroupSlugs, strikeCount] = await Promise.all([
                getUserGroupSlugs(userId, db),
                getUserStrikeCount(userId, db),
            ]);

            const isPrioritized = isUserPrioritized({
                userGroupSlugs,
                eventPools: event.pools,
                strikeCount,
                enforcesPreviousStrikes: event.enforcesPreviousStrikes,
            });

            if (!isPrioritized) {
                throw new HTTPException(403, {
                    message:
                        "This event only allows members in a priority pool to register",
                });
            }
        }

        // Check if user is already registered
        if (existingRegistration) {
            throw new HTTPException(409, {
                message: "User is already registered for this event",
            });
        }

        // Bildesamtykket bor på profilen, ikke på arrangementet. Uten et
        // eksplisitt felt i kallet er kontoinnstillingen fasit; brukere uten
        // innstillinger (ikke onboardet) faller tilbake på kolonnedefaulten.
        const allowPhoto =
            body.allowPhoto ?? userSettings?.allowsPhotosByDefault ?? true;

        // Create pending registration in database
        await db.insert(schema.eventRegistration).values({
            eventId,
            userId,
            status: "pending",
            allowPhoto,
        });

        /**
         * Be om at plassen avgjøres med én gang, i stedet for å vente på
         * neste cron-tikk. Svaret her sier fortsatt «pending» — resolveren
         * kjører i en jobb, nettopp for at requesten ikke skal holde på en
         * databasetilkobling mens den står i kø bak låsen — men klienten
         * finner den avklarte statusen på første poll i stedet for etter opp
         * til fem sekunder.
         */
        await enqueueRegistrationResolve(eventId, ctx);

        return c.json({
            eventId,
            userId,
            status: "pending" as const,
            createdAt: now.toISOString(),
            allowPhoto,
        });
    },
);
