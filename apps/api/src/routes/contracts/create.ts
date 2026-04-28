import { schema } from "@photon/db";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { contractSchema, createContractSchema } from "./schema";

export const createContractRoute = route().post(
    "/",
    describeRoute({
        tags: ["contracts"],
        summary: "Create a new contract version",
        operationId: "createContract",
        description:
            "Registers a new contract version. Does not auto-activate. Upload the PDF via POST /api/assets first, then pass the returned fileKey here. Requires 'contracts:create' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: contractSchema,
            description: "Contract created",
        })
        .badRequest()
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    requireAccess({ permission: "contracts:create" }),
    validator("json", createContractSchema),
    async (c) => {
        const body = c.req.valid("json");
        const user = c.get("user");
        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const { db } = c.get("ctx");

        const [newContract] = await db
            .insert(schema.contract)
            .values({
                ...body,
                createdByUserId: user.id,
            })
            .returning();

        if (!newContract) {
            throw new HTTPException(500, {
                message: "Failed to create contract",
            });
        }

        return c.json(
            {
                ...newContract,
                createdAt: newContract.createdAt.toISOString(),
                updatedAt: newContract.updatedAt.toISOString(),
            },
            201,
        );
    },
);
