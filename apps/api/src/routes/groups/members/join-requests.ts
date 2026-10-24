import { getPermissionGroupScopes } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPAppException } from "~/lib/errors";
import { addUserToGroup } from "~/lib/group";
import { isGroupLeader } from "~/lib/group/middleware";
import { sendNotification } from "~/lib/notification";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    joinRequestListSchema,
    membershipResponseSchema,
    pendingJoinRequestListSchema,
} from "../schema";
import { findGroup, joinRequestWhere } from "./self";

const requireGroupManager = requireAccess({
    permission: "groups:manage",
    scope: (c) => `group:${c.req.param("groupSlug")}`,
    ownership: { param: "groupSlug", check: isGroupLeader },
});

export const listJoinRequestsRoute = route().get(
    "/:groupSlug/join-requests",
    describeRoute({
        tags: ["groups"],
        summary: "List join requests",
        operationId: "listGroupJoinRequests",
        description:
            "Pending requests to join the group, oldest first. Requires 'groups:manage' (globally or scoped to the group), or being the group's leader.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: joinRequestListSchema,
            description: "Pending join requests",
        })
        .build(),
    requireAuth,
    requireGroupManager,
    async (c) => {
        const { db } = c.get("ctx");
        const requests = await db.query.groupJoinRequest.findMany({
            where: eq(
                schema.groupJoinRequest.groupSlug,
                c.req.param("groupSlug"),
            ),
            orderBy: asc(schema.groupJoinRequest.createdAt),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        username: true,
                        image: true,
                    },
                },
            },
        });
        return c.json(
            requests.map((request) => ({
                userId: request.userId,
                groupSlug: request.groupSlug,
                createdAt: request.createdAt.toISOString(),
                user: request.user,
            })),
        );
    },
);

export const approveJoinRequestRoute = route().post(
    "/:groupSlug/join-requests/:userId/approve",
    describeRoute({
        tags: ["groups"],
        summary: "Approve join request",
        operationId: "approveGroupJoinRequest",
        description:
            "Make the requester a member and tell them. Requires 'groups:manage' (globally or scoped to the group), or being the group's leader.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: membershipResponseSchema,
            description: "Requester is now a member",
        })
        .notFound({ description: "No pending request" })
        .build(),
    requireAuth,
    requireGroupManager,
    async (c) => {
        const ctx = c.get("ctx");
        const userId = c.req.param("userId");
        const group = await findGroup(ctx, c.req.param("groupSlug"));

        const request = await ctx.db.query.groupJoinRequest.findFirst({
            where: joinRequestWhere(group.slug, userId),
        });
        if (!request) {
            throw HTTPAppException.NotFound("Join request");
        }

        const membership = await addUserToGroup(ctx, userId, group.slug);

        try {
            await sendNotification(
                {
                    userId,
                    title: `Du er med i ${group.name}`,
                    description: `Forespørselen din om å bli med i ${group.name} er godkjent.`,
                    link: `/grupper/${group.slug}`,
                },
                ctx,
            );
        } catch (error) {
            c.get("logger")?.error(
                { err: error, groupSlug: group.slug },
                "Failed to notify approved join request",
            );
        }

        return c.json(membership, 201);
    },
);

export const declineJoinRequestRoute = route().post(
    "/:groupSlug/join-requests/:userId/decline",
    describeRoute({
        tags: ["groups"],
        summary: "Decline join request",
        operationId: "declineGroupJoinRequest",
        description:
            "Delete the request and tell the requester; they may ask again later. Requires 'groups:manage' (globally or scoped to the group), or being the group's leader.",
    })
        .response({ statusCode: 204, description: "Request declined" })
        .notFound({ description: "No pending request" })
        .build(),
    requireAuth,
    requireGroupManager,
    async (c) => {
        const ctx = c.get("ctx");
        const userId = c.req.param("userId");
        const group = await findGroup(ctx, c.req.param("groupSlug"));

        const [removed] = await ctx.db
            .delete(schema.groupJoinRequest)
            .where(joinRequestWhere(group.slug, userId))
            .returning();
        if (!removed) {
            throw HTTPAppException.NotFound("Join request");
        }

        try {
            await sendNotification(
                {
                    userId,
                    title: `Forespørselen til ${group.name} ble avslått`,
                    description: `Lederen avslo forespørselen din om å bli med i ${group.name}.`,
                    link: `/grupper/${group.slug}`,
                },
                ctx,
            );
        } catch (error) {
            c.get("logger")?.error(
                { err: error, groupSlug: group.slug },
                "Failed to notify declined join request",
            );
        }

        return c.body(null, 204);
    },
);

export const listMyPendingJoinRequestsRoute = route().get(
    "/join-requests",
    describeRoute({
        tags: ["groups"],
        summary: "List join requests waiting on me",
        operationId: "listPendingGroupJoinRequests",
        description:
            "Pending join requests across every group the caller can answer for: groups they lead, and groups where they hold 'groups:manage'. Oldest first.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: pendingJoinRequestListSchema,
            description: "Join requests waiting on the caller",
        })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const userId = c.get("user").id;

        const managed = await getPermissionGroupScopes(
            ctx,
            userId,
            "groups:manage",
        );
        let slugs: string[] | null = null;
        if (managed !== "*") {
            const led = await ctx.db.query.groupMembership.findMany({
                where: and(
                    eq(schema.groupMembership.userId, userId),
                    eq(schema.groupMembership.role, "leader"),
                ),
                columns: { groupSlug: true },
            });
            slugs = [...new Set([...managed, ...led.map((m) => m.groupSlug)])];
            if (slugs.length === 0) return c.json([]);
        }

        const requests = await ctx.db.query.groupJoinRequest.findMany({
            where: slugs
                ? inArray(schema.groupJoinRequest.groupSlug, slugs)
                : undefined,
            orderBy: asc(schema.groupJoinRequest.createdAt),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        username: true,
                        image: true,
                    },
                },
                group: { columns: { slug: true, name: true } },
            },
        });
        return c.json(
            requests.map((request) => ({
                userId: request.userId,
                groupSlug: request.groupSlug,
                createdAt: request.createdAt.toISOString(),
                user: request.user,
                group: request.group,
            })),
        );
    },
);
