import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { env } from "~/lib/env";
import { HTTPAppException } from "~/lib/errors";
import { acceptsJoinRequests, removeUserFromGroup } from "~/lib/group";
import { sendNotification } from "~/lib/notification";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { joinRequestSchema } from "../schema";

type Group = typeof schema.group.$inferSelect;

export async function findGroup(ctx: AppContext, slug: string): Promise<Group> {
    const group = await ctx.db.query.group.findFirst({
        where: eq(schema.group.slug, slug),
    });
    if (!group) {
        throw HTTPAppException.NotFound("Group");
    }
    return group;
}

async function findMembership(ctx: AppContext, slug: string, userId: string) {
    return ctx.db.query.groupMembership.findFirst({
        where: and(
            eq(schema.groupMembership.groupSlug, slug),
            eq(schema.groupMembership.userId, userId),
        ),
    });
}

export function joinRequestWhere(slug: string, userId: string) {
    return and(
        eq(schema.groupJoinRequest.groupSlug, slug),
        eq(schema.groupJoinRequest.userId, userId),
    );
}

async function notifyLeadersOfJoinRequest(
    ctx: AppContext,
    group: Group,
    requesterId: string,
): Promise<void> {
    const requester = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, requesterId),
        columns: { name: true },
    });
    const leaders = await ctx.db.query.groupMembership.findMany({
        where: and(
            eq(schema.groupMembership.groupSlug, group.slug),
            eq(schema.groupMembership.role, "leader"),
        ),
        columns: { userId: true },
    });

    const title = `Ny forespørsel i ${group.name}`;
    const description = `${requester?.name ?? "Noen"} vil bli med i ${group.name}.`;
    const link = `/grupper/${group.slug}?tab=medlemmer`;

    const results = await Promise.allSettled(
        leaders.map((leader) =>
            sendNotification(
                { userId: leader.userId, title, description, link },
                ctx,
            ),
        ),
    );
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
        throw new AggregateError(
            failures.map((failure) => failure.reason),
            `Failed to notify ${failures.length} of ${leaders.length} leaders`,
        );
    }

    if (leaders.length === 0 && group.contactEmail) {
        await ctx.email.sendEmailTemplate(
            { from: env.MAIL_FROM, to: group.contactEmail, subject: title },
            "NotificationMail",
            {
                title,
                description,
                link: `${env.WEBSITE_URL}${link}`,
                logoUrl: `${env.WEBSITE_URL}/logo512.png`,
            },
        );
    }
}

export const requestToJoinRoute = route().post(
    "/:groupSlug/join",
    describeRoute({
        tags: ["groups"],
        summary: "Ask to join group",
        operationId: "requestToJoinGroup",
        description:
            "Ask to join an interest group. The group's leaders are notified and approve or decline the request; a group without leaders gets an email at its contact address instead.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: joinRequestSchema,
            description: "Request sent",
        })
        .badRequest({ description: "The group does not take requests" })
        .notFound({ description: "Group not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const userId = c.get("user").id;
        const group = await findGroup(ctx, c.req.param("groupSlug"));

        if (!acceptsJoinRequests(group)) {
            throw HTTPAppException.BadRequest(
                "Denne gruppen tar ikke imot forespørsler",
            );
        }
        if (await findMembership(ctx, group.slug, userId)) {
            throw HTTPAppException.Conflict("Du er allerede medlem av gruppen");
        }

        const [request] = await ctx.db
            .insert(schema.groupJoinRequest)
            .values({ userId, groupSlug: group.slug })
            .onConflictDoNothing()
            .returning();
        if (!request) {
            throw HTTPAppException.Conflict(
                "Du har allerede bedt om å bli med i gruppen",
            );
        }

        try {
            await notifyLeadersOfJoinRequest(ctx, group, userId);
        } catch (error) {
            c.get("logger")?.error(
                { err: error, groupSlug: group.slug },
                "Failed to notify group leaders of join request",
            );
        }

        return c.json(request, 201);
    },
);

export const withdrawJoinRequestRoute = route().delete(
    "/:groupSlug/join",
    describeRoute({
        tags: ["groups"],
        summary: "Withdraw join request",
        operationId: "withdrawGroupJoinRequest",
        description: "Withdraw the caller's pending request to join a group.",
    })
        .response({ statusCode: 204, description: "Request withdrawn" })
        .notFound({ description: "No pending request" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const userId = c.get("user").id;
        const [removed] = await ctx.db
            .delete(schema.groupJoinRequest)
            .where(joinRequestWhere(c.req.param("groupSlug"), userId))
            .returning();
        if (!removed) {
            throw HTTPAppException.NotFound("Join request");
        }
        return c.body(null, 204);
    },
);

export const leaveGroupRoute = route().post(
    "/:groupSlug/leave",
    describeRoute({
        tags: ["groups"],
        summary: "Leave group",
        operationId: "leaveGroup",
        description:
            "Leave an interest group. Leaders have to hand over the leadership first, so the group is never left without one by accident.",
    })
        .response({ statusCode: 204, description: "Left the group" })
        .badRequest({ description: "The group cannot be left this way" })
        .notFound({ description: "Group or membership not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const userId = c.get("user").id;
        const group = await findGroup(ctx, c.req.param("groupSlug"));

        if (group.type.toLowerCase() !== "interestgroup") {
            throw HTTPAppException.BadRequest(
                "Bare interessegrupper kan du melde deg ut av selv",
            );
        }

        const membership = await findMembership(ctx, group.slug, userId);
        if (!membership) {
            throw HTTPAppException.NotFound("Membership");
        }
        if (membership.role === "leader") {
            throw HTTPAppException.BadRequest(
                "Gi fra deg ledervervet før du melder deg ut",
            );
        }

        await removeUserFromGroup(ctx, userId, group.slug);

        return c.body(null, 204);
    },
);
