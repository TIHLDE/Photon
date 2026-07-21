import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { deleteQRCodeResponseSchema, idParamSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["qr-codes"],
        summary: "Delete a QR code",
        operationId: "deleteQRCode",
        description:
            "Delete one of your own QR codes. Someone else's code reads as not found rather than forbidden, so the endpoint does not confirm that an id exists.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteQRCodeResponseSchema,
            description: "QR code deleted",
        })
        .notFound({ description: "QR code not found" })
        .build(),
    requireAuth,
    validator("param", idParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { id } = c.req.valid("param");

        const [deleted] = await db
            .delete(schema.qrCode)
            .where(
                and(eq(schema.qrCode.id, id), eq(schema.qrCode.userId, userId)),
            )
            .returning({ id: schema.qrCode.id });

        if (!deleted) {
            throw new HTTPException(404, { message: "QR code not found" });
        }

        return c.json({ message: "QR code deleted successfully" });
    },
);
