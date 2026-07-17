import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { AppContext } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";

/**
 * Stream a stored, signed contract PDF.
 *
 * The signed PDF is a private asset, so this route is the only way to reach it —
 * GET /api/assets/:key refuses private assets. Stamping already happened at
 * signing time; this just authorizes the caller and streams the stored bytes.
 */
async function streamSignedPdf(
    ctx: AppContext,
    userId: string,
): Promise<Response> {
    const { db, bucket } = ctx;

    const activeContract = await db.query.contract.findFirst({
        where: eq(schema.contract.isActive, true),
    });

    if (!activeContract) {
        throw HTTPAppException.NotFound("Contract");
    }

    const signature = await db.query.contractSignature.findFirst({
        where: and(
            eq(schema.contractSignature.contractId, activeContract.id),
            eq(schema.contractSignature.userId, userId),
        ),
    });

    if (!signature) {
        throw HTTPAppException.NotFound("Signature");
    }

    const content = await bucket.download(signature.signedPdfKey);
    const filename = `${activeContract.title}-${signature.signedName}.pdf`;

    return new Response(new Uint8Array(content), {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Length": content.length.toString(),
            "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
            // Signed contracts are personal — never let a shared cache hold one.
            "Cache-Control": "private, no-store",
        },
    });
}

export const getMySignedPdfRoute = route().get(
    "/signed-pdf",
    describeRoute({
        tags: ["contracts"],
        summary: "Download my signed contract",
        operationId: "getMySignedContractPdf",
        description:
            "Streams the authenticated user's signed copy of the active contract, with their signature stamped in.",
    })
        .response({
            statusCode: 200,
            description: "The signed contract PDF",
        })
        .notFound({ description: "No active contract, or not signed yet" })
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

        return streamSignedPdf(c.get("ctx"), user.id);
    },
);

export const getUserSignedPdfRoute = route().get(
    "/signed-pdf/:userId",
    describeRoute({
        tags: ["contracts"],
        summary: "Download a member's signed contract",
        operationId: "getUserSignedContractPdf",
        description:
            "Streams a member's signed copy of the active contract. Requires 'contracts:manage' permission.",
    })
        .response({
            statusCode: 200,
            description: "The signed contract PDF",
        })
        .notFound({ description: "No active contract, or not signed yet" })
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    requireAccess({ permission: "contracts:manage" }),
    async (c) => streamSignedPdf(c.get("ctx"), c.req.param("userId")),
);
