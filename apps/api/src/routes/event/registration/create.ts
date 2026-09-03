import { hasPermission } from "@photon/auth/rbac";
import { userHasRole } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import {
    getUserInstituteIds,
    isUserInInstitute,
} from "../../../lib/event/institute";
import {
    getUserPriorityFacts,
    isUserPrioritized,
} from "../../../lib/event/priority";
import { enqueueRegistrationResolve } from "../../../lib/event/resolve-queue";
import { getUserStrikeCount } from "../../../lib/event/strikes";
import { getUnansweredEvaluations } from "../../../lib/form/evaluation";
import { route } from "../../../lib/route";
import { hasAcceptedEventRules } from "../../../lib/user/settings";
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
            "Create a new registration for the authenticated user to attend an event, initially with pending status. Requires the 'events:registrations:create' permission — granted by the member baseline role (active students), not by the alumni role — unless the event has openToAlumni set, which lets alumni register for that event alone.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventRegistrationResponseSchema,
            description: "OK",
        })
        .notFound({ description: "Event not found" })
        .forbidden({
            description:
                "User may not register for events at all, has not accepted the event rules, owes an answer to an evaluation, or the event only allows members covered by a priority pool or members of a specific institute to register",
        })
        .response({
            statusCode: 409,
            description:
                "Event is not open for registration or user already registered",
        })
        .build(),
    requireAuth,
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
            canRegisterForEvents,
            hasAcceptedRules,
            unanswered,
            existingRegistration,
            userSettings,
        ] = await Promise.all([
            db.query.event.findFirst({
                where: (event, { eq }) => eq(event.id, eventId),
                with: {
                    pools: true,
                    priorityUsers: true,
                    restrictedToInstitute: true,
                },
            }),
            hasPermission(ctx, userId, "events:registrations:create"),
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

        /**
         * Retten til å melde seg på er en rolletilgang, ikke noe ved
         * arrangementet: `member` har den, `alumni` har den ikke, og det er
         * hele forskjellen på de to. Sjekken lå derfor i mellomvaren, som
         * aldri får se arrangementet.
         *
         * Den måtte hit ned for at `openToAlumni` skulle bety noe. Et
         * arrangement som er åpnet for alumni slipper dem inn — bare dem, og
         * bare der: alle andre uten tilgangen stoppes fortsatt, og alumni
         * stoppes fortsatt på hvert arrangement som ikke er åpnet.
         *
         * Rollen slås bare opp når tilgangen mangler, så et vanlig medlem
         * betaler ikke for spørringen.
         */
        if (!canRegisterForEvents) {
            const isAlumni =
                event.openToAlumni &&
                (await userHasRole(ctx, userId, "alumni"));

            if (!isAlumni) {
                throw new HTTPException(403, {
                    message:
                        "Forbidden - requires permission: events:registrations:create",
                });
            }
        }

        if (event.isRegistrationClosed || !event.requiresSigningUp) {
            throw new HTTPException(409, {
                message: "Event is not open for registration",
            });
        }

        /**
         * The registration window, enforced by the server rather than only by
         * the button.
         *
         * It was only the button. When the immatrikuleringsball opened on
         * 2026-08-21, nine members were already registered before the opening
         * second — the earliest by 16 seconds. It cost nobody a spot that time,
         * because the event did not fill up, but on an event that does, those
         * are the first spots, handed out by whoever bypassed the frontend or
         * whose clock ran fast.
         *
         * `createdAt` is the server's own timestamp and the resolver decides in
         * that order, so the only way to make the queue honest is to refuse the
         * ones that arrive early here.
         */
        if (event.registrationStart && now < event.registrationStart) {
            throw new HTTPException(409, {
                message: "Registration has not opened yet",
            });
        }

        if (event.registrationEnd && now > event.registrationEnd) {
            throw new HTTPException(409, {
                message: "Registration has closed",
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
            const [priorityFacts, strikeCount] = await Promise.all([
                getUserPriorityFacts(userId, db),
                getUserStrikeCount(userId, db),
            ]);

            const isPrioritized = isUserPrioritized({
                userGroupSlugs: priorityFacts.groupSlugs,
                userClassYear: priorityFacts.classYear,
                supersededStudySlugs: priorityFacts.supersededStudySlugs,
                event,
                strikeCount,
                enforcesPreviousStrikes: event.enforcesPreviousStrikes,
                isNamedIndividually: event.priorityUsers.some(
                    (entry) => entry.userId === userId,
                ),
            });

            if (!isPrioritized) {
                throw new HTTPException(403, {
                    message:
                        "This event only allows members in a priority pool to register",
                });
            }
        }

        // Check if user is already registered.
        //
        // En kansellert rad er ikke en påmelding — den er sporet etter en som
        // tok slutt: fristen gikk ut, prikkene sperret, eller påmeldingen ble
        // stengt. Varselet brukeren får sier rett ut «Du kan melde deg på på
        // nytt», men raden ble liggende og svarte 409 på forsøket. Sperren
        // gjelder bare plasser som faktisk står.
        if (
            existingRegistration &&
            existingRegistration.status !== "cancelled"
        ) {
            throw new HTTPException(409, {
                message: "User is already registered for this event",
            });
        }

        // Bildesamtykket bor på profilen, ikke på arrangementet. Uten et
        // eksplisitt felt i kallet er kontoinnstillingen fasit; brukere uten
        // innstillinger (ikke onboardet) faller tilbake på kolonnedefaulten.
        const allowPhoto =
            body.allowPhoto ?? userSettings?.allowsPhotosByDefault ?? true;

        // Create pending registration in database.
        //
        // Primærnøkkelen er (bruker, arrangement), så en ny påmelding etter en
        // kansellert er den samme raden om igjen. Alt som hørte til den forrige
        // runden nullstilles: ventelisteplassen, og oppmøtet — som ikke kan
        // stamme fra en påmelding som ble kansellert, men som en gammel
        // Lepton-importert rad kan bære.
        await db
            .insert(schema.eventRegistration)
            .values({
                eventId,
                userId,
                status: "pending",
                allowPhoto,
            })
            .onConflictDoUpdate({
                target: [
                    schema.eventRegistration.userId,
                    schema.eventRegistration.eventId,
                ],
                set: {
                    status: "pending",
                    allowPhoto,
                    waitlistPosition: null,
                    attendedAt: null,
                    // Samme klokke som kolonnedefaulten, ikke en JS-Date:
                    // resolveren køordner på `createdAt`, og to tidskilder
                    // ville gitt den nye påmeldingen feil plass i køen.
                    createdAt: sql`now()`,
                    updatedAt: sql`now()`,
                },
                setWhere: eq(schema.eventRegistration.status, "cancelled"),
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
