import { schema } from "@photon/db";
import { env } from "@photon/core/env";
import { eq } from "drizzle-orm";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { activeContractSchema } from "./schema";

export const getActiveContractRoute = route().get(
    "/active",
    describeRoute({
        tags: ["contracts"],
        summary: "Get active contract",
        operationId: "getActiveContract",
        description:
            "Returns the currently active volunteer contract with a direct download URL for the PDF.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: activeContractSchema,
            description: "Active contract",
        })
        .notFound({ description: "No active contract" })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        if (!activeContract) {
            throw HTTPAppException.NotFound("Contract");
        }

        const downloadUrl = `${env.ROOT_URL}/api/assets/${activeContract.fileKey}`;

        return c.json(
            {
                ...activeContract,
                createdAt: activeContract.createdAt.toISOString(),
                updatedAt: activeContract.updatedAt.toISOString(),
                downloadUrl,
            },
            200,
        );
    },
);
