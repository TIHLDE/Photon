import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { signatureStatusSchema } from "./schema";

export const mySignatureRoute = route().get(
    "/my-signature",
    describeRoute({
        tags: ["contracts"],
        summary: "Get my signature status",
        operationId: "getMySignatureStatus",
        description:
            "Returns whether the authenticated user has signed the currently active contract.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: signatureStatusSchema,
            description: "Signature status",
        })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const user = c.get("user");
        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const { db } = c.get("ctx");

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        if (!activeContract) {
            return c.json({ hasSigned: false, signedAt: null }, 200);
        }

        const signature = await db.query.contractSignature.findFirst({
            where: and(
                eq(schema.contractSignature.contractId, activeContract.id),
                eq(schema.contractSignature.userId, user.id),
            ),
        });

        return c.json(
            {
                hasSigned: !!signature,
                signedAt: signature?.signedAt?.toISOString() ?? null,
            },
            200,
        );
    },
);
