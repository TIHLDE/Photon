import { randomBytes } from "node:crypto";
import { env } from "@photon/core/env";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

/** 32 tilfeldige byte i base64url — 43 tegn, umulig å gjette. */
function generateToken(): string {
    return randomBytes(32).toString("base64url");
}

/** Full URL kalenderklienter abonnerer på. */
export function calendarFeedUrl(token: string): string {
    return `${env.ROOT_URL}/api/event/calendar/${token}/events.ics`;
}

/**
 * Henter brukerens kalendernøkkel, og lager den første gang den etterspørres.
 * Nøkkelen finnes altså ikke før brukeren faktisk ber om abonnements-URL-en.
 */
export async function getOrCreateCalendarToken(
    userId: string,
    ctx: AppContext,
): Promise<string> {
    const { db } = ctx;

    const existing = await db.query.userCalendarToken.findFirst({
        where: eq(schema.userCalendarToken.userId, userId),
        columns: { token: true },
    });

    if (existing) return existing.token;

    const token = generateToken();

    // To parallelle kall kan begge bomme på lookupen over; da vinner den
    // første og den andre får tilbake nøkkelen som allerede ble lagret.
    const [row] = await db
        .insert(schema.userCalendarToken)
        .values({ userId, token })
        .onConflictDoNothing()
        .returning({ token: schema.userCalendarToken.token });

    if (row) return row.token;

    const stored = await db.query.userCalendarToken.findFirst({
        where: eq(schema.userCalendarToken.userId, userId),
        columns: { token: true },
    });

    return stored?.token ?? token;
}

/**
 * Bytter nøkkelen. Gamle abonnement slutter å virke umiddelbart, som er
 * hele poenget: det er slik man trekker tilbake en URL man har delt.
 */
export async function regenerateCalendarToken(
    userId: string,
    ctx: AppContext,
): Promise<string> {
    const { db } = ctx;
    const token = generateToken();

    await db
        .insert(schema.userCalendarToken)
        .values({ userId, token })
        .onConflictDoUpdate({
            target: schema.userCalendarToken.userId,
            set: { token, updatedAt: new Date() },
        });

    return token;
}
