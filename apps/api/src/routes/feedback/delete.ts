import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isFeedbackAuthor } from "~/lib/feedback/middleware";
import { getFeedbackItem } from "~/lib/feedback/serialize";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { feedbackIdParamSchema, feedbackMessageResponseSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["feedback"],
        summary: "Delete feedback",
        operationId: "deleteFeedback",
        description:
            "Delete a piece of feedback. Requires 'feedback:delete' or 'feedback:manage', or being the author while it is still open and nobody else has voted or commented.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackMessageResponseSchema,
            description: "Feedback deleted",
        })
        .forbidden({ description: "Insufficient permissions" })
        .response({
            statusCode: 409,
            description:
                "The author can no longer delete it: it has moved past open, or someone else has voted or commented",
        })
        .notFound({ description: "Feedback not found" })
        .build(),
    requireAuth,
    // Before `requireAccess`: its ownership check looks the row up by this id,
    // so an unparseable one would reach the database there rather than here.
    validator("param", feedbackIdParamSchema),
    requireAccess({
        permission: ["feedback:delete", "feedback:manage"],
        ownership: { param: "id", check: isFeedbackAuthor },
    }),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.valid("param");
        const userId = c.get("user").id;

        const existing = await db.query.feedback.findFirst({
            where: eq(schema.feedback.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        // Deleting would take Index's replies and everyone's votes with it, so
        // the author is held to the same lock as editing; Index is not.
        if (c.get("isResourceOwner")) {
            const mayDelete = await hasPermission(c.get("ctx"), userId, [
                "feedback:delete",
                "feedback:manage",
            ]);
            const current = await getFeedbackItem(db, id, userId);

            if (!mayDelete && !current?.isEditable) {
                throw new HTTPException(409, {
                    message:
                        "Feedback can only be deleted by its author while it is open and nobody else has voted or commented",
                });
            }
        }

        await db.delete(schema.feedback).where(eq(schema.feedback.id, id));

        return c.json({ message: "Tilbakemeldingen ble slettet" });
    },
);
