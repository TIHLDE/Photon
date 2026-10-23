import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { hasPermission } from "@photon/auth/rbac";
import { getFeedbackItem } from "~/lib/feedback/serialize";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { feedbackIdParamSchema, feedbackItemSchema } from "./schema";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["feedback"],
        summary: "Get feedback",
        operationId: "getFeedback",
        description: "A single idea or bug report. Requires authentication.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackItemSchema,
            description: "OK",
        })
        .notFound({ description: "Feedback not found" })
        .build(),
    requireAuth,
    validator("param", feedbackIdParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.valid("param");
        const userId = c.get("user").id;

        const item = await getFeedbackItem(
            db,
            id,
            userId,
            await hasPermission(c.get("ctx"), userId, [
                "feedback:update",
                "feedback:manage",
            ]),
        );

        if (!item) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        return c.json(item);
    },
);
