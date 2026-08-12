import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isFeedbackAuthor } from "~/lib/feedback/middleware";
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
            "Delete a piece of feedback. Requires 'feedback:delete' or 'feedback:manage', or being the author.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackMessageResponseSchema,
            description: "Feedback deleted",
        })
        .forbidden({ description: "Insufficient permissions" })
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

        const existing = await db.query.feedback.findFirst({
            where: eq(schema.feedback.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        await db.delete(schema.feedback).where(eq(schema.feedback.id, id));

        return c.json({ message: "Tilbakemeldingen ble slettet" });
    },
);
