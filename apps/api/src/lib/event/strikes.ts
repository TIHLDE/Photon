import { eq, sum } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "~/db";
import { schema } from "~/db";

/**
 * Get the total number of strikes a user has accumulated
 */
export async function getUserStrikeCount(
    userId: string,
    db: NodePgDatabase<DbSchema>,
): Promise<number> {
    const result = await db
        .select({ total: sum(schema.eventStrike.count) })
        .from(schema.eventStrike)
        .where(eq(schema.eventStrike.userId, userId));

    const total = result[0]?.total;

    // sum() returns string | null, so we need to parse it
    return total ? Number.parseInt(total, 10) : 0;
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
    const allowedTime = new Date(
        registrationStart.getTime() + hoursToWait * 60 * 60 * 1000,
    );

    if (pendingCreatedAt < allowedTime) {
        return {
            allowed: false,
            reason: `Du har ${strikeCount} prikk${strikeCount > 1 ? "er" : ""} og må vente ${hoursToWait} timer etter påmeldingsstart før du kan melde deg på.`,
        };
    }

    return { allowed: true };
}
