import { schema } from "@photon/db";
import { and, eq, inArray } from "drizzle-orm";
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
            with: { user: true },
        });

        const memberIds = memberships.map((m) => m.userId);

        const signatures =
            activeContract && memberIds.length > 0
                ? await db.query.contractSignature.findMany({
                      where: and(
                          eq(
                              schema.contractSignature.contractId,
                              activeContract.id,
                          ),
                          inArray(schema.contractSignature.userId, memberIds),
                      ),
                  })
                : [];

        const signatureMap = new Map(
            signatures.map((s) => [s.userId, s]),
        );

        const results = memberships.map((m) => {
            const sig = signatureMap.get(m.userId);
            return {
                userId: m.userId,
                userName: m.user.name,
                userEmail: m.user.email,
                hasSigned: !!sig,
                signedAt: sig?.signedAt?.toISOString() ?? null,
            };
        });

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
