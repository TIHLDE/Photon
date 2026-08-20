import { schema } from "@photon/db";
import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { EVENT_ARRANGER_PERMISSIONS, canActOnEvent } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { eventAllergiesResponseSchema } from "../schema";
import { DEFAULT_STATUSES } from "../registration/list";

type SummaryEntry = { label: string; count: number; custom: boolean };

/**
 * Nøkkelen to oppføringer må dele for å telles som samme allergi.
 *
 * Etiketten, ikke slugen. Lepton-importen la igjen flere katalograder med
 * samme navn — «Peanøtter» finnes som både `peanotter` og `peanøtter` — så en
 * gruppering på slug ga kjøkkenet «Peanøtter × 2» to ganger. Samme regel
 * fanger også at én har huket av katalogvalget og en annen har skrevet det
 * samme inn for hånd.
 */
function summaryKey(label: string) {
    return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Beholder én oppføring per etikett — se {@link summaryKey}. */
function dedupeByLabel<T extends { label: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = summaryKey(item.label);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export const getEventAllergiesRoute = route().get(
    "/:eventId/allergies",
    describeRoute({
        tags: ["events"],
        summary: "Get allergies for event participants",
        operationId: "getEventAllergies",
        description:
            "The allergies among everyone holding a spot on the event, for the arrangør who orders the food. Returns totals per allergy alongside the per-person detail, and counts how many have never answered — which is not the same as having none. Restricted to the people who run this event; allergies are health data, so the access follows the arrangement rather than a global permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventAllergiesResponseSchema,
            description: "OK",
        })
        .unauthorized({ description: "Authentication required" })
        .forbidden({ description: "Requires event admin permissions" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const eventId = c.req.param("eventId");

        const isEventAdmin = await canActOnEvent(ctx, user.id, eventId, [
            ...EVENT_ARRANGER_PERMISSIONS,
            "events:registrations:view",
        ]);

        if (!isEventAdmin) {
            throw new HTTPException(403, {
                message:
                    "Viewing participant allergies requires event admin permissions",
            });
        }

        // Only the people who actually hold a spot. Venteliste og avmeldte
        // skal ikke telles med — kjøkkenet lager mat til de som kommer.
        const registrations = await db.query.eventRegistration.findMany({
            where: and(
                eq(schema.eventRegistration.eventId, eventId),
                inArray(schema.eventRegistration.status, [...DEFAULT_STATUSES]),
            ),
            with: {
                user: {
                    columns: { id: true, name: true },
                    with: {
                        settings: {
                            columns: {
                                customAllergies: true,
                                allergiesConfirmedAt: true,
                            },
                            with: { allergies: { with: { allergy: true } } },
                        },
                    },
                },
            },
        });

        const participants = [];
        const counts = new Map<string, SummaryEntry>();

        let withAllergies = 0;
        let confirmedNone = 0;
        let notAnswered = 0;

        for (const registration of registrations) {
            const settings = registration.user.settings;
            const allergies = (settings?.allergies ?? []).map(
                (link) => link.allergy,
            );
            const customAllergies = settings?.customAllergies ?? [];
            const hasAny = allergies.length > 0 || customAllergies.length > 0;

            if (hasAny) {
                withAllergies++;
            } else if (settings?.allergiesConfirmedAt) {
                confirmedNone++;
            } else {
                notAnswered++;
            }

            if (!hasAny) continue;

            /**
             * Én person teller én gang per allergi, uansett hvor mange
             * katalograder som bærer samme navn. Uten dette teller et medlem
             * som har fått to like Lepton-rader hengt på seg dobbelt i tallet
             * kjøkkenet lager mat etter.
             */
            const seenForParticipant = new Set<string>();

            const add = (label: string, custom: boolean) => {
                const key = summaryKey(label);
                if (!key || seenForParticipant.has(key)) return;
                seenForParticipant.add(key);

                const entry = counts.get(key);
                if (entry) {
                    entry.count++;
                    // Har minst én huket den av fra katalogen, er den ikke
                    // lenger bare et fritekstsvar.
                    entry.custom = entry.custom && custom;
                } else {
                    counts.set(key, { label, count: 1, custom });
                }
            };

            for (const allergy of allergies) add(allergy.label, false);
            for (const value of customAllergies) add(value, true);

            participants.push({
                userId: registration.user.id,
                name: registration.user.name,
                // Samme sammenslåing i persondetaljen: to like merkelapper på
                // én rad er støy, ikke informasjon.
                allergies: dedupeByLabel(allergies),
                customAllergies: customAllergies.filter(
                    (value) =>
                        !allergies.some(
                            (a) => summaryKey(a.label) === summaryKey(value),
                        ),
                ),
            });
        }

        const summary = [...counts.values()].sort(
            (a, b) => b.count - a.count || a.label.localeCompare(b.label, "nb"),
        );

        participants.sort((a, b) => a.name.localeCompare(b.name, "nb"));

        return c.json(
            {
                totalParticipants: registrations.length,
                withAllergies,
                confirmedNone,
                notAnswered,
                summary,
                participants,
            },
            200,
        );
    },
);
