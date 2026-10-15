import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { getGroup, isGroupMember, isOpenForJoinRequests } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { notifyAfterSave } from "./notify";
import { createJoinRequestSchema, joinRequestSchema } from "./schema";

export const createJoinRequestRoute = route().post(
    "/:groupSlug/join-requests",
    describeRoute({
        tags: ["groups"],
        summary: "Ask to join an interest group",
        operationId: "createGroupJoinRequest",
        description:
            "Creates a pending join request for the caller and notifies the group's leaders. Only interest groups that take join requests accept them.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: joinRequestSchema,
            description: "Join request created",
        })
        .badRequest({ description: "The group does not take join requests" })
        .notFound({ description: "Group not found" })
        .response({
            statusCode: 409,
            description: "Already a member, or a request is already pending",
        })
        .build(),
    requireAuth,
    validator("json", createJoinRequestSchema),
    async (c) => {
        const { name, message } = c.req.valid("json");
        const ctx = c.get("ctx");
        const user = c.get("user");
        const groupSlug = c.req.param("groupSlug");

        const group = await getGroup(ctx, groupSlug);
        if (!group) throw HTTPAppException.NotFound("Group");
        if (!isOpenForJoinRequests(group)) {
            throw HTTPAppException.BadRequest(
                "Gruppen tar ikke imot nye medlemmer akkurat nå.",
            );
        }
        if (await isGroupMember(ctx, user.id, groupSlug)) {
            throw HTTPAppException.Conflict(
                "Du er allerede medlem av gruppen.",
            );
        }

        const [request] = await ctx.db
            .insert(schema.groupJoinRequest)
            .values({ userId: user.id, groupSlug, name, message })
            .onConflictDoNothing()
            .returning();
        if (!request) {
            throw HTTPAppException.Conflict(
                "Du har allerede bedt om å bli med i gruppen.",
            );
        }

        const leaders = await ctx.db
            .select({ userId: schema.groupMembership.userId })
            .from(schema.groupMembership)
            .where(
                and(
                    eq(schema.groupMembership.groupSlug, groupSlug),
                    eq(schema.groupMembership.role, "leader"),
                ),
            );

        await notifyAfterSave(ctx, c.get("logger"), [
            ...leaders.map((leader) => ({
                userId: leader.userId,
                title: `Ny søknad til ${group.name}`,
                description: `${name} vil bli med i ${group.name}: «${message}»`,
                link: `/grupper/${groupSlug}/medlemmer`,
            })),
            {
                userId: user.id,
                title: `Du har bedt om å bli med i ${group.name}`,
                description:
                    "Lederen av gruppen får beskjed og svarer på søknaden din.",
                link: `/grupper/${groupSlug}`,
            },
        ]);

        return c.json({ id: request.id, status: request.status }, 201);
    },
);
