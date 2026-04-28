import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { groupSignatureListSchema } from "./schema";

export const groupSignaturesRoute = route().get(
    "/groups/:groupSlug/signatures",
    describeRoute({
        tags: ["contracts"],
        summary: "Get member signing status for a group",
        operationId: "getGroupContractSignatures",
        description:
            "Returns all group members with their signing status for the active contract. Requires being a group leader or 'contracts:view' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: groupSignatureListSchema,
            description: "Member signing status",
        })
        .notFound({ description: "Group not found" })
        .forbidden()
        .unauthorized()
        .build(),
    requireAuth,
    requireAccess({
        permission: "contracts:view",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
        ownership: { param: "groupSlug", check: isGroupLeader },
    }),
    async (c) => {
        const groupSlug = c.req.param("groupSlug");
        const { db } = c.get("ctx");

        const grp = await db.query.group.findFirst({
            where: eq(schema.group.slug, groupSlug),
        });

        if (!grp) {
            throw new HTTPException(404, { message: "Group not found" });
        }

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        const memberships = await db.query.groupMembership.findMany({
            where: eq(schema.groupMembership.groupSlug, groupSlug),
        });

        const results = await Promise.all(
            memberships.map(async (m) => {
                if (!activeContract) {
                    return {
                        userId: m.userId,
                        hasSigned: false,
                        signedAt: null,
                    };
                }

                const sig = await db.query.contractSignature.findFirst({
                    where: and(
                        eq(
                            schema.contractSignature.contractId,
                            activeContract.id,
                        ),
                        eq(schema.contractSignature.userId, m.userId),
                    ),
                });

                return {
                    userId: m.userId,
                    hasSigned: !!sig,
                    signedAt: sig?.signedAt?.toISOString() ?? null,
                };
            }),
        );

        return c.json(
            {
                members: results,
                totalMembers: results.length,
                signedCount: results.filter((r) => r.hasSigned).length,
            },
            200,
        );
    },
);
