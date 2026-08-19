/**
 * Access control for a single event, scoped to its organiser group.
 *
 * An event belongs to the group that arranges it, so the permission to touch
 * it should be answerable per group: "FadderKom's leader runs FadderKom's
 * arrangementer" is the arrangement people actually have. Checking only the
 * global permission — which is what these routes did — left one lever, and it
 * opened every group's events at once.
 *
 * A global grant still matches any scope (see `matchesPermission`), so nobody
 * who could act before loses access here; the check only widens.
 */

import type { AuthSession, AuthUser } from "@photon/auth";
import { hasPermission, hasScopedPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppContext } from "~/lib/ctx";
import type { OwnershipChecker } from "~/middleware/access";

type Variables = {
    user: AuthUser | null;
    session: AuthSession | null;
    ctx: AppContext;
    isResourceOwner?: boolean;
};

/**
 * Permissions that make you the arrangør of a group's events.
 *
 * Whoever may edit a group's arrangementer runs them, and running an
 * arrangement includes the prikker it produces: the no-shows belong to the
 * event the same way the påmeldte do. Requiring a separate `events:strikes:*`
 * on top meant the person who put the arrangement up could not deal with its
 * prikker — every group's leader list carried the event permissions and none
 * of them carried the strike ones, so the answer was always no.
 *
 * Held scoped to a group, this reaches that group's own events and nothing
 * else, so it cannot become a way into another group's prikker.
 */
export const EVENT_ARRANGER_PERMISSIONS = [
    "events:update",
    "events:manage",
] as const;

/**
 * Everything that lets you view, give or remove prikker on an event: the
 * strike permission itself, or simply arranging the event.
 */
export function strikePermissions(action: "view" | "create" | "delete") {
    return [`events:strikes:${action}`, ...EVENT_ARRANGER_PERMISSIONS];
}

/**
 * The slug of the group arranging `eventId`, or null when the event has no
 * organiser group (older events migrated from Lepton) or does not exist.
 */
export async function getEventOrganizerGroup(
    ctx: AppContext,
    eventId: string,
): Promise<string | null> {
    const [event] = await ctx.db
        .select({ organizerGroupSlug: schema.event.organizerGroupSlug })
        .from(schema.event)
        .where(eq(schema.event.id, eventId))
        .limit(1);

    return event?.organizerGroupSlug ?? null;
}

/**
 * Whether `userId` holds `permission` for this event: globally, or scoped to
 * the group arranging it.
 *
 * Events without an organiser group fall back to the global check — there is
 * no group to scope to, so the only honest answer is the old one.
 */
export async function canActOnEvent(
    ctx: AppContext,
    userId: string,
    eventId: string,
    permission: string | string[],
): Promise<boolean> {
    const groupSlug = await getEventOrganizerGroup(ctx, eventId);

    return groupSlug
        ? hasScopedPermission(ctx, userId, permission, `group:${groupSlug}`)
        : hasPermission(ctx, userId, permission);
}

/**
 * Whether `userId` may arrange events for `groupSlug` — the same question as
 * {@link canActOnEvent}, for an event that does not exist yet.
 */
export async function canActOnEventsForGroup(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
    permission: string | string[],
): Promise<boolean> {
    return hasScopedPermission(ctx, userId, permission, `group:${groupSlug}`);
}

type RequireEventAccessOptions = {
    /** Permission(s) required — any one of them suffices. */
    permission: string | string[];
    /** Route param holding the event id. Defaults to "eventId". */
    param?: string;
    /**
     * Optional ownership check, mirroring `requireAccess`: an owner passes
     * without holding the permission, and `isResourceOwner` is set for the
     * handler.
     */
    ownership?: OwnershipChecker;
};

/**
 * `requireAccess`, but scoped to the event's organiser group.
 *
 * A missing event is left to the handler: it falls through to the global
 * check so the route can answer 404 rather than a misleading 403.
 */
export const requireEventAccess = (options: RequireEventAccessOptions) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");
        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const ctx = c.get("ctx");
        const eventId = c.req.param(options.param ?? "eventId");
        if (!eventId) {
            throw new HTTPException(400, { message: "Event ID required" });
        }

        if (options.ownership) {
            if (await options.ownership(ctx, eventId, user.id)) {
                c.set("isResourceOwner", true);
                await next();
                return;
            }
        }

        if (!(await canActOnEvent(ctx, user.id, eventId, options.permission))) {
            const permStr = Array.isArray(options.permission)
                ? options.permission.join(" or ")
                : options.permission;
            throw new HTTPException(403, {
                message: `Forbidden - requires permission: ${permStr} (globally or for the arranging group)`,
            });
        }

        c.set("isResourceOwner", false);
        await next();
    });
