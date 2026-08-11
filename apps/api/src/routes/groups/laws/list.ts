import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isGroupMember } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { lawListSchema } from "./schema";

export const listLawsRoute = route().get(
    "/:groupSlug/laws",
    describeRoute({
        tags: ["laws"],
        summary: "List a group's laws (lovverk)",
        operationId: "listLaws",
        description:
            "Retrieve the fine laws for a group, ordered by paragraph. Group members can view their own group's laws (Lepton parity), as can the fines admin and root.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: lawListSchema,
            description: "List of laws retrieved successfully",
        })
        .forbidden({
            description: "Not authorized to view laws for this group",
        })
        .notFound({ description: "Group not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");

        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        const isMember = await isGroupMember(ctx, user.id, groupSlug);
        const isFinesAdmin = group.finesAdminId === user.id;

        const hasViewPermission =
            isMember ||
            isFinesAdmin ||
            (await hasPermission(ctx, user.id, "root"));

        if (!hasViewPermission) {
            throw new HTTPException(403, {
                message: "Not authorized to view laws for this group",
            });
        }

        const laws = await db
            .select()
            .from(schema.groupLaw)
            .where(eq(schema.groupLaw.groupSlug, groupSlug))
            .orderBy(asc(schema.groupLaw.paragraph));

        return c.json(laws);
    },
);
