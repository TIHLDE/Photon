import { schema } from "@photon/db";
import { desc } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { contractListSchema } from "./schema";

export const listContractsRoute = route().get(
    "/",
    describeRoute({
        tags: ["contracts"],
        summary: "List all contract versions",
        operationId: "listContracts",
        description:
            "Returns all contract versions newest first. Requires 'contracts:view' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: contractListSchema,
            description: "List of contracts",
        })
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    requireAccess({ permission: "contracts:view" }),
    async (c) => {
        const { db } = c.get("ctx");

        const contracts = await db
            .select()
            .from(schema.contract)
            .orderBy(desc(schema.contract.createdAt));

        return c.json(
            contracts.map((contract) => ({
                ...contract,
                createdAt: contract.createdAt.toISOString(),
                updatedAt: contract.updatedAt.toISOString(),
            })),
            200,
        );
    },
);
