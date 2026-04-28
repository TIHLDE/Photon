import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { revokeSignatureResponseSchema } from "./schema";

export const revokeSignatureRoute = route().delete(
    "/groups/:groupSlug/signatures/:userId",
    describeRoute({
        tags: ["contracts"],
        summary: "Revoke a member's contract signature",
        operationId: "revokeContractSignature",
        description:
            "Removes a member's signature from the active contract. Requires being a group leader or 'contracts:manage' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: revokeSignatureResponseSchema,
            description: "Signature revoked",
        })
        .notFound({ description: "Signature not found" })
        .forbidden()
        .unauthorized()
        .build(),
    requireAuth,
    requireAccess({
        permission: "contracts:manage",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
        ownership: { param: "groupSlug", check: isGroupLeader },
    }),
    async (c) => {
        const userId = c.req.param("userId");
        const { db } = c.get("ctx");

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        if (!activeContract) {
            throw new HTTPException(404, { message: "No active contract" });
        }

        const deleted = await db
            .delete(schema.contractSignature)
            .where(
                and(
                    eq(schema.contractSignature.contractId, activeContract.id),
                    eq(schema.contractSignature.userId, userId),
                ),
            )
            .returning();

        if (deleted.length === 0) {
            throw new HTTPException(404, { message: "Signature not found" });
        }

        return c.json({ message: "Signature revoked" }, 200);
    },
);
