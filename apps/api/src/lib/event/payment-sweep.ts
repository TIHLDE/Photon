import { schema } from "@photon/db";
import {
    and,
    asc,
    eq,
    gt,
    gte,
    inArray,
    isNotNull,
    lte,
    notExists,
    or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AppContext } from "../ctx";
import { handlePaymentExpiration } from "./payment";

/**
 * Hvor mange forfalte forpliktelser én runde tar.
 *
 * `handlePaymentExpiration` spør betalingsleverandøren før den tar noe fra
 * noen, så hver rad er et nettverkskall. Uten et tak ville en runde etter et
 * køtap på et stort arrangement kunnet løpe inn i den neste. Resten står til
 * neste tikk — de har allerede ventet, og rekkefølgen er eldste først.
 */
const SWEEP_BATCH_SIZE = 100;

/**
 * Forpliktelser som allerede er `failed`, men der plassen fortsatt står.
 *
 * Et avbrutt Vipps-kjøp gjør raden `failed` med en gang, mens plassen blir
 * stående til fristen. Har køen mistet timeren, er det ingen som tar den.
 *
 * Avgrensningene hindrer at runden tar en plass den ikke skal ta. Fristen må ha
 * tilhørt denne påmeldingen, arrangementet må være betalt og ikke over, og bare
 * den nyeste raden med egen frist teller. En betaling stopper runden, og det
 * gjør også en refusjon på denne påmeldingen: refunderer en arrangør uten å
 * frigjøre plassen, skal den stå. Er påmeldingen endret etter fristen, har noen
 * tatt stilling til den, for eksempel en arrangør som retter en innsjekking.
 */
async function findReclaimableFailedObligations(
    ctx: AppContext,
    now: Date,
): Promise<Array<{ id: string; eventId: string; userId: string }>> {
    const payment = schema.eventPayment;
    const registration = schema.eventRegistration;
    const other = alias(schema.eventPayment, "other_payment");

    return ctx.db
        .select({
            id: payment.id,
            eventId: payment.eventId,
            userId: payment.userId,
        })
        .from(payment)
        .innerJoin(
            registration,
            and(
                eq(registration.eventId, payment.eventId),
                eq(registration.userId, payment.userId),
                eq(registration.status, "registered"),
                gte(payment.createdAt, registration.createdAt),
                lte(registration.updatedAt, payment.expiresAt),
            ),
        )
        .innerJoin(
            schema.event,
            and(
                eq(schema.event.id, payment.eventId),
                eq(schema.event.isPaidEvent, true),
                gt(schema.event.end, now),
            ),
        )
        .where(
            and(
                eq(payment.status, "failed"),
                isNotNull(payment.expiresAt),
                lte(payment.expiresAt, now),
                notExists(
                    ctx.db
                        .select({ id: other.id })
                        .from(other)
                        .where(
                            and(
                                eq(other.eventId, payment.eventId),
                                eq(other.userId, payment.userId),
                                or(
                                    eq(other.status, "paid"),
                                    and(
                                        eq(other.status, "refunded"),
                                        gte(
                                            other.createdAt,
                                            registration.createdAt,
                                        ),
                                    ),
                                    and(
                                        gt(other.createdAt, payment.createdAt),
                                        inArray(other.status, [
                                            "pending",
                                            "failed",
                                        ]),
                                        isNotNull(other.expiresAt),
                                    ),
                                ),
                            ),
                        ),
                ),
            ),
        )
        .orderBy(asc(payment.expiresAt))
        .limit(SWEEP_BATCH_SIZE);
}

/**
 * Håndhev betalingsfrister som har forfalt uten at timeren tok dem.
 *
 * Fristen håndheves normalt av en forsinket jobb i køen, lagt inn når
 * forpliktelsen opprettes. Køen ligger i Redis, og Redis i prod har ingen
 * varig lagring: en omstart tar med seg alle forsinkede jobber. Da fantes det
 * ingen vei tilbake — ingenting leste `expires_at` fra basen, så en ubetalt
 * plass ble aldri inndratt og ventelista rykket aldri.
 *
 * Dette er samme sikkerhetsnett som påmeldingene har hatt hele tiden (se
 * `startRegistrationResolverCron`): basen er fasiten, køen bare en snarvei som
 * gjør at fristen håndheves på sekundet i stedet for ved neste tikk.
 *
 * Kaller den samme handleren som køen, ikke en kopi av logikken. Den leser
 * betalingen på nytt og står ned av seg selv om den er betalt, refundert,
 * avmeldt eller erstattet av en nyere forpliktelse — så det gjør ingenting om
 * både jobben og denne runden treffer samme rad.
 *
 * @returns Antall forpliktelser som ble håndtert i denne runden.
 */
export async function enforceExpiredPaymentDeadlines(
    ctx: AppContext,
): Promise<number> {
    const now = new Date();
    const pending = await ctx.db.query.eventPayment.findMany({
        columns: { id: true, eventId: true, userId: true },
        where: {
            status: "pending",
            expiresAt: { isNotNull: true, lte: now },
        },
        // Eldste først: de har ventet lengst, og med et tak per runde er det
        // dem som ellers ville blitt stående igjen.
        orderBy: { expiresAt: "asc" },
        limit: SWEEP_BATCH_SIZE,
    });
    const failed = await findReclaimableFailedObligations(ctx, now);

    let handled = 0;

    for (const payment of [...pending, ...failed]) {
        try {
            await handlePaymentExpiration(ctx, {
                eventId: payment.eventId,
                userId: payment.userId,
                paymentId: payment.id,
            });
            handled += 1;
        } catch (error) {
            // Én rad som feiler skal ikke stoppe resten: de andre har like
            // forfalte frister, og en leverandør som er nede for den ene er
            // ikke nødvendigvis nede for de andre.
            console.error(
                `Error enforcing payment deadline for payment ${payment.id}:`,
                error,
            );
        }
    }

    return handled;
}
