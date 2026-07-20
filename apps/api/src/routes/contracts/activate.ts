import { schema } from "@photon/db";
import { eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { activateContractResponseSchema } from "./schema";

export const activateContractRoute = route().patch(
    "/:id/activate",
    describeRoute({
        tags: ["contracts"],
        summary: "Activate a contract version",
        operationId: "activateContract",
        description:
            "Sets the specified contract as active; deactivates all others. Requires 'contracts:update' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: activateContractResponseSchema,
            description: "Contract activated",
        })
        .notFound({ description: "Contract not found" })
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    requireAccess({ permission: "contracts:update" }),
    async (c) => {
        const id = c.req.param("id");
        const { db } = c.get("ctx");

        const existing = await db.query.contract.findFirst({
            where: eq(schema.contract.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, { message: "Contract not found" });
        }

        await db.transaction(async (tx) => {
            await tx
                .update(schema.contract)
                .set({ isActive: false, updatedAt: new Date() })
                .where(ne(schema.contract.id, id));

            await tx
                .update(schema.contract)
                .set({ isActive: true, updatedAt: new Date() })
                .where(eq(schema.contract.id, id));
        });

        return c.json({ message: "Contract activated" }, 200);
    },
);
