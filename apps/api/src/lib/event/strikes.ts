import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Get the total number of strikes a user has accumulated
 */
export async function getUserStrikeCount(
    userId: string,
    db: NodePgDatabase<DbSchema>,
): Promise<number> {
    const rows = await db
        .select({ count: schema.eventStrike.count })
        .from(schema.eventStrike)
        .where(eq(schema.eventStrike.userId, userId));

    return rows.reduce((total, row) => total + row.count, 0);
}

interface CanRegisterResult {
    allowed: boolean;
    reason?: string;
}

/**
 * Check if a user can register based on strike-based timing restrictions
 *
 * - 1 strike: must wait 3 hours after registration start
 * - 2+ strikes: must wait 12 hours after registration start
 */
export function canRegisterBasedOnStrikes(
    strikeCount: number,
    registrationStart: Date | null,
    pendingCreatedAt: Date,
): CanRegisterResult {
    if (strikeCount === 0 || !registrationStart) {
        return { allowed: true };
    }

    const hoursToWait = strikeCount === 1 ? 3 : 12;
    const registrationStartDate = new Date(registrationStart);
    const pendingCreatedAtDate = new Date(pendingCreatedAt);
    const allowedTime = new Date(
        registrationStartDate.getTime() + hoursToWait * 60 * 60 * 1000,
    );

    if (pendingCreatedAtDate < allowedTime) {
        return {
            allowed: false,
            reason: `Du har ${strikeCount} prikk${strikeCount > 1 ? "er" : ""} og må vente ${hoursToWait} timer etter påmeldingsstart før du kan melde deg på.`,
        };
    }

    return { allowed: true };
}
