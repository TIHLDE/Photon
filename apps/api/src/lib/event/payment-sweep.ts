import { schema } from "@photon/db";
import { and, asc, eq, isNotNull, lte } from "drizzle-orm";
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
    const overdue = await ctx.db.query.eventPayment.findMany({
        columns: { id: true, eventId: true, userId: true },
        where: and(
            eq(schema.eventPayment.status, "pending"),
            isNotNull(schema.eventPayment.expiresAt),
            lte(schema.eventPayment.expiresAt, new Date()),
        ),
        // Eldste først: de har ventet lengst, og med et tak per runde er det
        // dem som ellers ville blitt stående igjen.
        orderBy: asc(schema.eventPayment.expiresAt),
        limit: SWEEP_BATCH_SIZE,
    });

    let handled = 0;

    for (const payment of overdue) {
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
