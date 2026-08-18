import {
    hasPermission,
    hasPermissionInAnyGroupScope,
    hasScopedPermission,
} from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { ilike, or } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import z from "zod";
import type { AppContext } from "~/lib/ctx";
import { isGroupLeader } from "~/lib/group/middleware";
import { Schema, describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

export const userSearchResultSchema = Schema(
    "UserSearchResult",
    z.array(
        z.object({
            id: z.string(),
            name: z.string().nullable(),
            username: z.string().nullable(),
            image: z.string().nullable(),
        }),
    ),
);

/**
 * Søket brukes til tre ting: å tildele roller/verv (admin), å finne noen som
 * skal legges til i en gruppe, og å peke ut enkeltpersoner på et arrangement
 * (prioritert påmelding). Tilgangen speiler handlingen søket tjener — en
 * undergruppeleder har lov til å legge til medlemmer i sin egen gruppe, og må
 * derfor kunne søke opp folk når `groupSlug` peker på den gruppen. Uten
 * `groupSlug` er det fortsatt bare `users:view`/`roles:assign` som gjelder, så
 * hele brukerregisteret ikke blir åpent for enhver leder.
 *
 * Arrangøren slipper inn på `events:create`/`events:update`/`events:manage`
 * holdt for minst én gruppe. Den prioriterte kan være hvem som helst på
 * nettsiden — en foredragsholder, en fadder, en som fikk plass lovet — så det
 * finnes ingen gruppe å begrense søket til, og et arrangement er ikke bundet
 * til arrangørgruppas medlemmer.
 */
const requireUserSearchAccess = createMiddleware<{
    Variables: {
        user: { id: string } | null;
        ctx: AppContext;
    };
}>(async (c, next) => {
    const user = c.get("user");
    if (!user) {
        throw new HTTPException(401, { message: "Authentication required" });
    }
    const ctx = c.get("ctx");

    if (await hasPermission(ctx, user.id, ["users:view", "roles:assign"])) {
        await next();
        return;
    }

    if (
        await hasPermissionInAnyGroupScope(ctx, user.id, [
            "events:create",
            "events:update",
            "events:manage",
        ])
    ) {
        await next();
        return;
    }

    const groupSlug = c.req.query("groupSlug");
    if (groupSlug) {
        const canManageGroup =
            (await hasScopedPermission(
                ctx,
                user.id,
                "groups:manage",
                `group:${groupSlug}`,
            )) || (await isGroupLeader(ctx, groupSlug, user.id));
        if (canManageGroup) {
            await next();
            return;
        }
    }

    throw new HTTPException(403, {
        message:
            "Forbidden - requires permission: users:view, roles:assign or an events permission, or the right to manage the given group",
    });
});

export const searchUsersRoute = route().get(
    "/search",
    describeRoute({
        tags: ["users"],
        summary: "Search users",
        operationId: "searchUsers",
        description:
            "Search users by name or username (case-insensitive substring). Used by admin UIs to assign roles and positions, and to name individually prioritized users on an event. Requires 'users:view' or 'roles:assign', or an event permission ('events:create'/'events:update'/'events:manage') held for at least one group — or, when 'groupSlug' is given, the right to manage that group's roster ('groups:manage' scoped to it, or being its leader).",
    })
        .schemaResponse({
            statusCode: 200,
            schema: userSearchResultSchema,
            description: "Matching users",
        })
        .forbidden({
            description:
                "Requires users:view or roles:assign, or the right to manage the given group",
        })
        .build(),
    requireAuth,
    requireUserSearchAccess,
    validator(
        "query",
        z.object({
            q: z
                .string()
                .min(2)
                .max(100)
                .meta({ description: "Search term (name or username)" }),
            groupSlug: z.string().optional().meta({
                description:
                    "Group the search is for. Lets that group's leader (or anyone with 'groups:manage' for it) search users in order to add members.",
            }),
        }),
    ),
    async (c) => {
        const { db } = c.get("ctx");
        const { q } = c.req.valid("query");

        const pattern = `%${q.trim()}%`;
        const users = await db
            .select({
                id: schema.user.id,
                name: schema.user.name,
                username: schema.user.username,
                image: schema.user.image,
            })
            .from(schema.user)
            .where(
                or(
                    ilike(schema.user.name, pattern),
                    ilike(schema.user.username, pattern),
                ),
            )
            .orderBy(schema.user.name)
            .limit(10);

        return c.json(users);
    },
);
