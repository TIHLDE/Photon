import { schema } from "@photon/db";
import { desc, eq } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { qrCodeListResponseSchema } from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["qr-codes"],
        summary: "List your QR codes",
        operationId: "listQRCodes",
        description:
            "Every QR code the authenticated member has created, newest first. A member only ever sees their own codes, so there is nothing to page through.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: qrCodeListResponseSchema,
            description: "OK",
        })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;

        const codes = await db.query.qrCode.findMany({
            where: eq(schema.qrCode.userId, userId),
            orderBy: [desc(schema.qrCode.createdAt)],
        });

        return c.json(
            codes.map((code) => ({
                id: code.id,
                name: code.name,
                content: code.content,
                createdAt: code.createdAt.toISOString(),
                updatedAt: code.updatedAt.toISOString(),
            })),
            200,
        );
    },
);
