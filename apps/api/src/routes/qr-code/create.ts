import { schema } from "@photon/db";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { createQRCodeSchema, qrCodeSchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["qr-codes"],
        summary: "Create a QR code",
        operationId: "createQRCode",
        description:
            "Create a QR code owned by the authenticated member. The code itself is rendered client side from the stored content.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: qrCodeSchema,
            description: "QR code created",
        })
        .build(),
    requireAuth,
    validator("json", createQRCodeSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const body = c.req.valid("json");

        const [created] = await db
            .insert(schema.qrCode)
            .values({
                name: body.name,
                content: body.content,
                userId,
            })
            .returning();

        if (!created) {
            throw new HTTPException(500, {
                message: "Failed to create QR code",
            });
        }

        return c.json(
            {
                id: created.id,
                name: created.name,
                content: created.content,
                createdAt: created.createdAt.toISOString(),
                updatedAt: created.updatedAt.toISOString(),
            },
            201,
        );
    },
);
