import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

/**
 * Whether `userId` created the event and is still in the group arranging it.
 *
 * `created_by_user_id` is stamped once and never changes, while membership
 * does: the one who set up an event and later left the group would otherwise
 * keep the right to edit and delete it for good, long after the group stopped
 * being theirs. Membership is the test because leaving deletes the roster row
 * — see `groupMembershipHistory`.
 *
 * An event with no arranging group has no group to leave, so its creator keeps
 * it.
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

    if (!event || event.createdByUserId !== userId) {
        return false;
    }

    if (!event.organizerGroupSlug) {
        return true;
    }

    const membership = await ctx.db
        .select()
        .from(schema.groupMembership)
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                eq(schema.groupMembership.groupSlug, event.organizerGroupSlug),
            ),
        )
        .limit(1)
        .then((res) => res[0]);

    return !!membership;
};
