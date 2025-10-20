import { eq } from "drizzle-orm";
import { schema } from "~/db";
import type { AppContext } from "~/lib/ctx";

/**
 * Check if a user is the creator/owner of an event.
 */
export const isEventOwner = async (
    ctx: AppContext,
    eventId: string,
    userId: string,
): Promise<boolean> => {
    const event = await ctx.db
        .select()
        .from(schema.event)
        .where(eq(schema.event.id, eventId))
        .limit(1)
        .then((res) => res[0]);

    return event?.createdByUserId === userId;
};
