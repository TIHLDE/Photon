import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { addUserToGroup, getGroup } from "~/lib/group";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { isValidUUID } from "~/lib/validation/uuid";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { notifyAfterSave } from "./notify";
import { handleJoinRequestSchema, joinRequestSchema } from "./schema";

export const handleJoinRequestRoute = route().patch(
    "/:groupSlug/join-requests/:requestId",
    describeRoute({
        tags: ["groups"],
        summary: "Approve or reject a join request",
        operationId: "handleGroupJoinRequest",
        description:
            "Approving adds the applicant as a regular member. Requires being the group's leader, or 'groups:manage' (globally or scoped to the group).",
    })
        .schemaResponse({
            statusCode: 200,
            schema: joinRequestSchema,
            description: "Join request handled",
        })
        .notFound({ description: "No pending request with that ID" })
        .build(),
    requireAuth,
    requireAccess({
        permission: "groups:manage",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
        ownership: { param: "groupSlug", check: isGroupLeader },
    }),
    validator("json", handleJoinRequestSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { status } = c.req.valid("json");
        const groupSlug = c.req.param("groupSlug");
        const requestId = c.req.param("requestId");

        if (!isValidUUID(requestId)) {
            throw HTTPAppException.NotFound("Join request");
        }

        // Only a pending request matches, so two answers at once can't both apply.
        const [request] = await ctx.db
            .update(schema.groupJoinRequest)
            .set({ status })
            .where(
                and(
                    eq(schema.groupJoinRequest.id, requestId),
                    eq(schema.groupJoinRequest.groupSlug, groupSlug),
                    eq(schema.groupJoinRequest.status, "pending"),
                ),
            )
            .returning();
        if (!request) throw HTTPAppException.NotFound("Join request");

        if (status === "approved") {
            await addUserToGroup(ctx, request.userId, groupSlug);
        }

        const group = await getGroup(ctx, groupSlug);
        const groupName = group?.name ?? groupSlug;
        await notifyAfterSave(ctx, c.get("logger"), [
            {
                userId: request.userId,
                link: `/grupper/${groupSlug}`,
                ...(status === "approved"
                    ? {
                          title: `Gratulerer! Du er nå medlem i ${groupName}`,
                          description: "Søknaden din ble godkjent.",
                      }
                    : {
                          title: "Søknaden din ble dessverre avvist",
                          description: `Søknaden din til ${groupName} ble avvist. Du kan søke på nytt senere.`,
                      }),
            },
        ]);

        return c.json({ id: request.id, status: request.status }, 200);
    },
);
